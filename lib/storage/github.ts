import 'server-only';

import type { GitHubConfig } from '../config';
import { assertNoConflicts } from './conflicts';
import { gitBlobSha } from './git-hash';
import { readTar, stripRootDirectory } from './tar';
import {
  StorageError,
  type BinaryFile,
  type Change,
  type CommitResult,
  type Revision,
  type Storage,
  type TextFile,
} from './types';

/** Regular, non-executable file. The only mode this application creates. */
const FILE_MODE = '100644';

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string | null;
}

interface ContentsResponse {
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
}

/**
 * Stores notes in a GitHub repository over the REST API.
 *
 * Two decisions are worth knowing about before reading further:
 *
 * 1. Bulk reads go through the tarball endpoint. Building the note index needs
 *    every Markdown file; one archive download beats hundreds of blob requests
 *    and barely touches the rate limit.
 *
 * 2. Writes go through the Git Data API rather than the Contents API. It costs
 *    a few more requests but lets a rename, or a note plus its attachments,
 *    land as a single commit — which keeps the history readable.
 */
export class GitHubStorage implements Storage {
  constructor(private readonly config: GitHubConfig) {}

  private get repoUrl(): string {
    const { apiBaseUrl, owner, repository } = this.config;
    return `${apiBaseUrl}/repos/${owner}/${repository}`;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { accept?: string } = {},
  ): Promise<{ status: number; data: T }> {
    const { accept, ...rest } = init;
    let response: Response;
    try {
      response = await fetch(`${this.repoUrl}${path}`, {
        ...rest,
        cache: 'no-store',
        headers: {
          Accept: accept ?? 'application/vnd.github+json',
          Authorization: `Bearer ${this.config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'commonleaf',
          ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
          ...rest.headers,
        },
      });
    } catch (cause) {
      throw new StorageError('Could not reach GitHub.', undefined, { cause });
    }

    if (response.status === 404) {
      return { status: 404, data: null as T };
    }

    if (!response.ok) {
      throw new StorageError(await describeFailure(response), response.status);
    }

    const isJson = (accept ?? 'application/vnd.github+json').includes('json');
    const data = (isJson ? await response.json() : await response.arrayBuffer()) as T;
    return { status: response.status, data };
  }

  private async headSha(): Promise<string> {
    const { status, data } = await this.request<{ object: { sha: string } }>(
      `/git/ref/heads/${encodeURIComponent(this.config.branch)}`,
    );
    if (status === 404) {
      throw new StorageError(
        `Branch "${this.config.branch}" does not exist in ${this.config.owner}/${this.config.repository}. Create it, or set GITHUB_BRANCH.`,
        404,
      );
    }
    return data.object.sha;
  }

  async revision(): Promise<string> {
    return this.headSha();
  }

  async readTree(prefix: string): Promise<TextFile[]> {
    const sha = await this.headSha();
    const { data } = await this.request<ArrayBuffer>(`/tarball/${sha}`, {
      accept: 'application/vnd.github+tar',
    });

    const archive = await gunzip(new Uint8Array(data));
    const decoder = new TextDecoder();
    const wanted = prefix === '' ? '' : `${prefix}/`;

    return stripRootDirectory(readTar(archive))
      .filter((entry) => entry.path.startsWith(wanted) && entry.path.endsWith('.md'))
      .map((entry) => ({
        path: entry.path,
        sha: gitBlobSha(entry.bytes),
        size: entry.bytes.byteLength,
        content: decoder.decode(entry.bytes),
      }));
  }

  async read(path: string): Promise<TextFile | null> {
    const { status, data } = await this.request<ContentsResponse>(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(this.config.branch)}`,
    );
    if (status === 404 || !data) return null;

    return {
      path,
      sha: data.sha,
      size: data.size,
      content: Buffer.from(data.content ?? '', 'base64').toString('utf8'),
    };
  }

  async readBinary(path: string): Promise<BinaryFile | null> {
    const { status, data } = await this.request<ContentsResponse>(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(this.config.branch)}`,
    );
    if (status === 404 || !data) return null;

    // The Contents API omits the body for files over 1 MB; those come from the
    // blob endpoint instead, which has a far larger ceiling.
    const bytes =
      data.content && data.content.length > 0
        ? new Uint8Array(Buffer.from(data.content, 'base64'))
        : new Uint8Array(
            (
              await this.request<ArrayBuffer>(`/git/blobs/${data.sha}`, {
                accept: 'application/vnd.github.raw',
              })
            ).data,
          );

    return { path, sha: data.sha, size: data.size, bytes };
  }

  async commit(message: string, changes: readonly Change[]): Promise<CommitResult> {
    if (changes.length === 0) return { sha: null, blobs: {} };

    const parent = await this.headSha();
    const { data: parentCommit } = await this.request<{ tree: { sha: string } }>(
      `/git/commits/${parent}`,
    );
    const existing = await this.listTree(parentCommit.tree.sha);

    assertNoConflicts(changes, existing);

    const entries: TreeEntry[] = [];
    const blobs: Record<string, string> = {};

    for (const change of changes) {
      switch (change.kind) {
        case 'write': {
          const sha = await this.createBlob(change.content);
          blobs[change.path] = sha;
          entries.push({ path: change.path, mode: FILE_MODE, type: 'blob', sha });
          break;
        }
        case 'write-binary': {
          const sha = await this.createBlob(change.bytes);
          blobs[change.path] = sha;
          entries.push({ path: change.path, mode: FILE_MODE, type: 'blob', sha });
          break;
        }
        case 'delete': {
          entries.push({ path: change.path, mode: FILE_MODE, type: 'blob', sha: null });
          break;
        }
        case 'move': {
          const sha = existing.get(change.from);
          if (!sha) {
            throw new StorageError(`Cannot move "${change.from}": it no longer exists.`, 404);
          }
          blobs[change.to] = sha;
          entries.push({ path: change.to, mode: FILE_MODE, type: 'blob', sha });
          entries.push({ path: change.from, mode: FILE_MODE, type: 'blob', sha: null });
          break;
        }
      }
    }

    const { data: tree } = await this.request<{ sha: string }>('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: entries }),
    });

    // An unchanged tree means the edit was a round trip back to the original
    // text. Committing it would add noise to the history for no benefit.
    if (tree.sha === parentCommit.tree.sha) return { sha: null, blobs };

    const { data: commit } = await this.request<{ sha: string }>('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
    });

    await this.request(`/git/refs/heads/${encodeURIComponent(this.config.branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });

    return { sha: commit.sha, blobs };
  }

  async history(path: string, limit: number): Promise<Revision[]> {
    const query = new URLSearchParams({
      path,
      sha: this.config.branch,
      per_page: String(limit),
    });
    const { data } = await this.request<
      Array<{
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
      }>
    >(`/commits?${query}`);

    return (data ?? []).map((entry) => ({
      sha: entry.sha,
      message: entry.commit.message,
      author: entry.commit.author.name,
      date: entry.commit.author.date,
    }));
  }

  async readAtRevision(path: string, revision: string): Promise<string | null> {
    const { status, data } = await this.request<ContentsResponse>(
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(revision)}`,
    );
    if (status === 404 || !data) return null;
    return Buffer.from(data.content ?? '', 'base64').toString('utf8');
  }

  private async createBlob(content: string | Uint8Array): Promise<string> {
    const base64 =
      typeof content === 'string'
        ? Buffer.from(content, 'utf8').toString('base64')
        : Buffer.from(content).toString('base64');

    const { data } = await this.request<{ sha: string }>('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: base64, encoding: 'base64' }),
    });
    return data.sha;
  }

  /** Path to blob SHA for the whole repository at `treeSha`. */
  private async listTree(treeSha: string): Promise<Map<string, string>> {
    const { data } = await this.request<{
      tree: Array<{ path: string; type: string; sha: string }>;
    }>(`/git/trees/${treeSha}?recursive=1`);

    const map = new Map<string, string>();
    for (const entry of data.tree ?? []) {
      if (entry.type === 'blob') map.set(entry.path, entry.sha);
    }
    return map;
  }
}

/** Percent-encodes each segment while leaving the separators intact. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const { gunzipSync } = await import('node:zlib');
  return new Uint8Array(gunzipSync(bytes));
}

async function describeFailure(response: Response): Promise<string> {
  const detail = await response
    .json()
    .then((body: { message?: string }) => body?.message)
    .catch(() => undefined);

  if (response.status === 401) {
    return 'GitHub rejected the token. Check GITHUB_TOKEN and that it has the "Contents: read and write" permission.';
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return 'GitHub API rate limit reached. It resets within the hour.';
  }
  if (response.status === 409) {
    return 'The repository is empty. Push an initial commit before using it for storage.';
  }
  return detail
    ? `GitHub returned ${response.status}: ${detail}`
    : `GitHub returned ${response.status}.`;
}
