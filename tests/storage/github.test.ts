import { describe, expect, it, vi } from 'vitest';

import type { GitHubConfig } from '@/lib/config';
import { gitBlobSha } from '@/lib/storage/git-hash';
import { GitHubStorage } from '@/lib/storage/github';
import { ConflictError, StorageError } from '@/lib/storage/types';

import { GitHubMock } from '../helpers/github-mock';

const config: GitHubConfig = {
  token: 'test-token',
  owner: 'owner',
  repository: 'repo',
  branch: 'main',
  apiBaseUrl: 'https://api.github.com',
};

function setup(files: Record<string, string> = {}) {
  const mock = new GitHubMock({ files });
  mock.install();
  return { mock, storage: new GitHubStorage(config) };
}

describe('GitHubStorage', () => {
  describe('reading', () => {
    it('reads the whole content tree in a single archive request', async () => {
      const { mock, storage } = setup({
        'content/one.md': '# One\n',
        'content/nested/two.md': '# Two\n',
        'content/image.png': 'binary',
        'README.md': 'not a note',
      });

      const files = await storage.readTree('content');

      expect(files.map((file) => file.path)).toEqual([
        'content/one.md',
        'content/nested/two.md',
      ]);
      expect(files[0].content).toBe('# One\n');
      // One call for the branch head, one for the archive. Nothing per file.
      expect(mock.requests.filter((request) => request.url.includes('/git/blobs'))).toEqual([]);
    });

    it('reports SHAs that match what a single-file read reports', async () => {
      const { storage } = setup({ 'content/note.md': 'body\n' });

      const [fromTree] = await storage.readTree('content');
      const single = await storage.read('content/note.md');

      expect(single?.sha).toBe(fromTree.sha);
    });

    it('returns null for a file that does not exist', async () => {
      const { storage } = setup();
      expect(await storage.read('content/missing.md')).toBeNull();
    });

    it('encodes path segments without escaping the separators', async () => {
      const { mock, storage } = setup({ 'content/a b/note & more.md': 'x' });

      await storage.read('content/a b/note & more.md');

      expect(mock.requests.at(-1)?.url).toContain(
        '/contents/content/a%20b/note%20%26%20more.md',
      );
    });
  });

  describe('writing', () => {
    it('creates a file and records a commit', async () => {
      const { mock, storage } = setup();

      const result = await storage.commit('Update Reading', [
        { kind: 'write', path: 'content/reading.md', content: '# Reading\n' },
      ]);

      expect(result.sha).not.toBeNull();
      expect(mock.files.get('content/reading.md')).toBe('# Reading\n');
      expect(mock.lastCommit?.message).toBe('Update Reading');
    });

    it('groups several changes into one commit', async () => {
      const { mock, storage } = setup({ 'content/a.md': 'a' });

      await storage.commit('Update A', [
        { kind: 'write', path: 'content/a.md', content: 'a2' },
        { kind: 'write-binary', path: 'content/images/x.png', bytes: new Uint8Array([1, 2]) },
      ]);

      expect(mock.commitCount).toBe(1);
    });

    it('moves a file in a single commit, reusing the existing blob', async () => {
      const { mock, storage } = setup({ 'content/old.md': 'unchanged' });

      await storage.commit('Rename note', [
        { kind: 'move', from: 'content/old.md', to: 'content/new.md' },
      ]);

      expect(mock.files.has('content/old.md')).toBe(false);
      expect(mock.files.get('content/new.md')).toBe('unchanged');
      expect(mock.commitCount).toBe(1);
      // A move should not upload content that GitHub already stores.
      expect(mock.requests.some((request) => request.url.endsWith('/git/blobs'))).toBe(false);
    });

    it('deletes a file', async () => {
      const { mock, storage } = setup({ 'content/gone.md': 'x' });

      await storage.commit('Delete note', [{ kind: 'delete', path: 'content/gone.md' }]);

      expect(mock.files.has('content/gone.md')).toBe(false);
    });

    it('does nothing when there are no changes', async () => {
      const { mock, storage } = setup();

      expect(await storage.commit('Nothing', [])).toEqual({ sha: null, blobs: {} });
      expect(mock.requests).toEqual([]);
    });
  });

  describe('conflict detection', () => {
    it('accepts a write based on the current version', async () => {
      const { storage } = setup({ 'content/note.md': 'original' });

      await expect(
        storage.commit('Update', [
          {
            kind: 'write',
            path: 'content/note.md',
            content: 'edited',
            expectedSha: gitBlobSha('original'),
          },
        ]),
      ).resolves.toMatchObject({ sha: expect.any(String) });
    });

    it('refuses a write based on a version that has moved on', async () => {
      const { mock, storage } = setup({ 'content/note.md': 'changed by someone else' });

      const attempt = storage.commit('Update', [
        {
          kind: 'write',
          path: 'content/note.md',
          content: 'edited',
          expectedSha: gitBlobSha('what the editor loaded'),
        },
      ]);

      await expect(attempt).rejects.toBeInstanceOf(ConflictError);
      expect(mock.commitCount).toBe(0);
      expect(mock.files.get('content/note.md')).toBe('changed by someone else');
    });

    it('refuses to create a file that already exists', async () => {
      const { storage } = setup({ 'content/note.md': 'already here' });

      await expect(
        storage.commit('Create', [
          { kind: 'write', path: 'content/note.md', content: 'new', expectedSha: null },
        ]),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('skips the check when no base version is given', async () => {
      const { storage } = setup({ 'content/note.md': 'whatever' });

      await expect(
        storage.commit('Force', [
          { kind: 'write', path: 'content/note.md', content: 'overwritten' },
        ]),
      ).resolves.toBeTruthy();
    });
  });

  describe('errors', () => {
    it('explains an authentication failure in terms the reader can act on', async () => {
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
      const storage = new GitHubStorage(config);

      await expect(storage.revision()).rejects.toMatchObject({
        name: 'StorageError',
        status: 401,
        message: expect.stringContaining('GITHUB_TOKEN'),
      });
    });

    it('explains a rate limit', async () => {
      vi.stubGlobal(
        'fetch',
        async () =>
          new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
      );
      const storage = new GitHubStorage(config);

      await expect(storage.revision()).rejects.toThrow(/rate limit/i);
    });

    it('names the branch when it is missing', async () => {
      vi.stubGlobal('fetch', async () => new Response('{}', { status: 404 }));
      const storage = new GitHubStorage(config);

      await expect(storage.revision()).rejects.toThrow(/Branch "main" does not exist/);
    });

    it('wraps a network failure rather than leaking it', async () => {
      vi.stubGlobal('fetch', async () => {
        throw new TypeError('fetch failed');
      });
      const storage = new GitHubStorage(config);

      await expect(storage.revision()).rejects.toBeInstanceOf(StorageError);
    });
  });

  describe('history', () => {
    it('lists revisions newest first', async () => {
      const { storage } = setup();
      await storage.commit('First', [{ kind: 'write', path: 'content/a.md', content: '1' }]);
      await storage.commit('Second', [{ kind: 'write', path: 'content/a.md', content: '2' }]);

      const revisions = await storage.history('content/a.md', 10);

      expect(revisions.map((revision) => revision.message)).toEqual(['Second', 'First']);
    });
  });
});
