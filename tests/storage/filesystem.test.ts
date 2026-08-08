import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilesystemStorage } from '@/lib/storage/filesystem';
import { gitBlobSha } from '@/lib/storage/git-hash';
import { ConflictError, StorageError } from '@/lib/storage/types';

let root: string;
let storage: FilesystemStorage;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'commonleaf-'));
  storage = new FilesystemStorage({ root });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seed(relative: string, content: string): Promise<void> {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

describe('FilesystemStorage', () => {
  it('reads a tree of Markdown files and ignores everything else', async () => {
    await seed('content/one.md', '# One\n');
    await seed('content/nested/two.md', '# Two\n');
    await seed('content/photo.png', 'binary');
    await seed('other/three.md', '# Three\n');

    const files = await storage.readTree('content');

    expect(files.map((file) => file.path)).toEqual(['content/nested/two.md', 'content/one.md']);
  });

  it('skips dot directories such as .git', async () => {
    await seed('.git/objects/note.md', 'not a note');
    await seed('content/real.md', 'real');

    expect((await storage.readTree('')).map((file) => file.path)).toEqual(['content/real.md']);
  });

  it('computes the same SHAs as the GitHub driver', async () => {
    await seed('content/note.md', 'body\n');

    expect((await storage.read('content/note.md'))?.sha).toBe(gitBlobSha('body\n'));
  });

  it('creates nested directories on write', async () => {
    await storage.commit('Update Deep note', [
      { kind: 'write', path: 'content/a/b/c/deep.md', content: 'deep' },
    ]);

    expect(await readFile(path.join(root, 'content/a/b/c/deep.md'), 'utf8')).toBe('deep');
  });

  it('moves a file, creating the destination directory', async () => {
    await seed('content/old.md', 'contents');

    await storage.commit('Rename', [
      { kind: 'move', from: 'content/old.md', to: 'content/archive/new.md' },
    ]);

    expect(await storage.read('content/old.md')).toBeNull();
    expect((await storage.read('content/archive/new.md'))?.content).toBe('contents');
  });

  it('deletes a file', async () => {
    await seed('content/gone.md', 'x');

    await storage.commit('Delete', [{ kind: 'delete', path: 'content/gone.md' }]);

    expect(await storage.read('content/gone.md')).toBeNull();
  });

  it('refuses a write based on a stale version', async () => {
    await seed('content/note.md', 'newer');

    await expect(
      storage.commit('Update', [
        {
          kind: 'write',
          path: 'content/note.md',
          content: 'mine',
          expectedSha: gitBlobSha('older'),
        },
      ]),
    ).rejects.toBeInstanceOf(ConflictError);

    expect((await storage.read('content/note.md'))?.content).toBe('newer');
  });

  it('refuses to read outside the content root', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toBeInstanceOf(StorageError);

    await expect(
      storage.commit('Escape', [{ kind: 'write', path: '../escaped.md', content: 'nope' }]),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it('changes its revision token when a file changes', async () => {
    await seed('content/note.md', 'one');
    const before = await storage.revision();

    await storage.commit('Update', [
      { kind: 'write', path: 'content/note.md', content: 'two' },
    ]);

    expect(await storage.revision()).not.toBe(before);
  });

  it('reports no history when the directory is not a Git working tree', async () => {
    await seed('content/note.md', 'x');

    expect(await storage.history('content/note.md', 10)).toEqual([]);
  });
});
