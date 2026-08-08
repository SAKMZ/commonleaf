import { gzipSync } from 'node:zlib';

import { vi } from 'vitest';

import { gitBlobSha } from '@/lib/storage/git-hash';

import { buildRepositoryTar, type TarInput } from './tar';

/**
 * A small stand-in for the GitHub REST API.
 *
 * It models the handful of endpoints the driver uses against an in-memory
 * tree, so tests can assert on real behaviour — that a rename produces one
 * commit, that a stale write is refused — instead of on which URLs were
 * called. Requests it does not recognise fail loudly rather than returning
 * something plausible.
 */

export interface MockRepositoryOptions {
  files?: Record<string, string>;
  headSha?: string;
  branch?: string;
}

export interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

export class GitHubMock {
  readonly files: Map<string, string>;
  readonly requests: RecordedRequest[] = [];
  private headSha: string;
  private readonly branch: string;
  private blobs = new Map<string, Uint8Array>();
  private commits: Array<{ sha: string; message: string; paths: string[] }> = [];

  constructor(options: MockRepositoryOptions = {}) {
    this.files = new Map(Object.entries(options.files ?? {}));
    this.headSha = options.headSha ?? 'head000000000000000000000000000000000000';
    this.branch = options.branch ?? 'main';
  }

  /** Installs the mock as the global `fetch`. */
  install(): void {
    vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) =>
      this.handle(String(input), init),
    );
  }

  get commitCount(): number {
    return this.commits.length;
  }

  get lastCommit(): { sha: string; message: string; paths: string[] } | undefined {
    return this.commits.at(-1);
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handle(url: string, init: RequestInit): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ method, url, body });

    const path = url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, '');

    if (method === 'GET' && path === `/git/ref/heads/${this.branch}`) {
      return this.json({ object: { sha: this.headSha } });
    }

    if (method === 'GET' && path.startsWith('/tarball/')) {
      const entries: TarInput[] = [...this.files].map(([file, content]) => ({
        path: file,
        content,
      }));
      const archive = buildRepositoryTar(`owner-repo-${this.headSha.slice(0, 7)}`, entries);
      return new Response(gzipSync(archive));
    }

    if (method === 'GET' && path.startsWith('/contents/')) {
      const file = decodeURIComponent(path.slice('/contents/'.length).split('?')[0]);
      const content = this.files.get(file);
      if (content === undefined) return this.json({ message: 'Not Found' }, 404);
      return this.json({
        sha: gitBlobSha(content),
        size: Buffer.byteLength(content),
        encoding: 'base64',
        content: Buffer.from(content, 'utf8').toString('base64'),
      });
    }

    if (method === 'GET' && path.startsWith('/git/commits/')) {
      return this.json({ tree: { sha: `tree-of-${this.headSha}` } });
    }

    if (method === 'GET' && path.startsWith('/git/trees/')) {
      return this.json({
        tree: [...this.files].map(([file, content]) => ({
          path: file,
          type: 'blob',
          sha: gitBlobSha(content),
        })),
      });
    }

    if (method === 'POST' && path === '/git/blobs') {
      const bytes = new Uint8Array(Buffer.from(body.content, 'base64'));
      const sha = gitBlobSha(bytes);
      this.blobs.set(sha, bytes);
      return this.json({ sha });
    }

    if (method === 'POST' && path === '/git/trees') {
      // Apply the entries to the working tree so later reads see them.
      for (const entry of body.tree as Array<{ path: string; sha: string | null }>) {
        if (entry.sha === null) {
          this.files.delete(entry.path);
        } else {
          const bytes = this.blobs.get(entry.sha);
          this.files.set(
            entry.path,
            bytes ? new TextDecoder().decode(bytes) : this.findByBlobSha(entry.sha),
          );
        }
      }
      return this.json({ sha: `tree-${this.commits.length + 1}` });
    }

    if (method === 'POST' && path === '/git/commits') {
      const sha = `commit-${this.commits.length + 1}`;
      this.commits.push({ sha, message: body.message, paths: [...this.files.keys()] });
      return this.json({ sha });
    }

    if (method === 'PATCH' && path.startsWith('/git/refs/heads/')) {
      this.headSha = body.sha;
      return this.json({ object: { sha: body.sha } });
    }

    if (method === 'GET' && path.startsWith('/commits?')) {
      return this.json(
        this.commits
          .slice()
          .reverse()
          .map((commit) => ({
            sha: commit.sha,
            commit: {
              message: commit.message,
              author: { name: 'Test', date: '2026-01-01T00:00:00Z' },
            },
          })),
      );
    }

    throw new Error(`Unhandled request in GitHubMock: ${method} ${url}`);
  }

  /** A moved file reuses an existing blob rather than creating a new one. */
  private findByBlobSha(sha: string): string {
    for (const content of this.files.values()) {
      if (gitBlobSha(content) === sha) return content;
    }
    throw new Error(`GitHubMock has no blob ${sha}`);
  }
}
