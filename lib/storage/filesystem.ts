import 'server-only';

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { FilesystemConfig } from '../config';
import { assertNoConflicts } from './conflicts';
import { gitBlobSha } from './git-hash';
import {
  StorageError,
  type BinaryFile,
  type Change,
  type CommitResult,
  type Revision,
  type Storage,
  type TextFile,
} from './types';

const run = promisify(execFile);

/** Directories that never contain notes and are expensive to walk. */
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', '.next', '.obsidian']);

/**
 * Stores notes in a directory on disk.
 *
 * This is the driver for local development, for the test suite, and for
 * self-hosted deployments that keep the vault on a mounted volume. When the
 * directory happens to be a Git working tree the driver commits after every
 * change and can read history, so the guarantees match the GitHub driver. When
 * it is not, edits are still written — you simply lose version history.
 */
export class FilesystemStorage implements Storage {
  private gitAvailable: boolean | null = null;

  constructor(private readonly config: FilesystemConfig) {}

  /** Resolves a repository-relative path, refusing anything outside the root. */
  private resolve(relative: string): string {
    const root = path.resolve(this.config.root);
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new StorageError(`Refusing to access "${relative}" outside the content root.`, 400);
    }
    return target;
  }

  /**
   * Hashes the contents of the tree rather than its modification times.
   *
   * Timestamps are the cheaper signal, but their resolution is coarse enough
   * that two edits within the same tick can share one — and a revision token
   * that fails to change would serve stale notes indefinitely. Reading a few
   * hundred small files from local disk costs a few milliseconds, which is far
   * less than the index rebuild this token exists to avoid.
   */
  async revision(): Promise<string> {
    const hash = createHash('sha1');
    for (const file of await this.walk('')) {
      hash.update(file);
      hash.update(await readFile(this.resolve(file)));
    }
    return hash.digest('hex');
  }

  async readTree(prefix: string): Promise<TextFile[]> {
    const files = await this.walk(prefix);
    const markdown = files.filter((file) => file.endsWith('.md'));

    return Promise.all(
      markdown.map(async (file) => {
        const content = await readFile(this.resolve(file), 'utf8');
        return {
          path: file,
          sha: gitBlobSha(content),
          size: Buffer.byteLength(content),
          content,
        };
      }),
    );
  }

  async read(filePath: string): Promise<TextFile | null> {
    // `resolve` stays outside the try: a path that escapes the root is a bug
    // worth surfacing, not a missing file to shrug at.
    const absolute = this.resolve(filePath);
    try {
      const content = await readFile(absolute, 'utf8');
      return {
        path: filePath,
        sha: gitBlobSha(content),
        size: Buffer.byteLength(content),
        content,
      };
    } catch {
      return null;
    }
  }

  async readBinary(filePath: string): Promise<BinaryFile | null> {
    const absolute = this.resolve(filePath);
    try {
      const buffer = await readFile(absolute);
      const bytes = new Uint8Array(buffer);
      return { path: filePath, sha: gitBlobSha(bytes), size: bytes.byteLength, bytes };
    } catch {
      return null;
    }
  }

  async commit(message: string, changes: readonly Change[]): Promise<CommitResult> {
    if (changes.length === 0) return { sha: null, blobs: {} };

    const existing = new Map<string, string>();
    for (const change of changes) {
      if (change.kind !== 'write' || change.expectedSha === undefined) continue;
      const current = await this.read(change.path);
      if (current) existing.set(change.path, current.sha);
    }
    assertNoConflicts(changes, existing);

    const blobs: Record<string, string> = {};
    const touched: string[] = [];

    for (const change of changes) {
      switch (change.kind) {
        case 'write': {
          await this.writeFile(change.path, Buffer.from(change.content, 'utf8'));
          blobs[change.path] = gitBlobSha(change.content);
          touched.push(change.path);
          break;
        }
        case 'write-binary': {
          await this.writeFile(change.path, Buffer.from(change.bytes));
          blobs[change.path] = gitBlobSha(change.bytes);
          touched.push(change.path);
          break;
        }
        case 'delete': {
          await rm(this.resolve(change.path), { force: true });
          touched.push(change.path);
          break;
        }
        case 'move': {
          const to = this.resolve(change.to);
          await mkdir(path.dirname(to), { recursive: true });
          await rename(this.resolve(change.from), to);
          touched.push(change.from, change.to);
          break;
        }
      }
    }

    const sha = await this.gitCommit(message, touched);
    return { sha, blobs };
  }

  async history(filePath: string, limit: number): Promise<Revision[]> {
    if (!(await this.hasGit())) return [];

    // A record separator that cannot occur in a commit message.
    const format = '%H%x1f%an%x1f%aI%x1f%s';
    const { stdout } = await this.git([
      'log',
      `--max-count=${limit}`,
      `--format=${format}`,
      '--',
      filePath,
    ]);

    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, author, date, message] = line.split('\x1f');
        return { sha, author, date, message };
      });
  }

  async readAtRevision(filePath: string, revision: string): Promise<string | null> {
    if (!(await this.hasGit())) return null;
    try {
      const { stdout } = await this.git(['show', `${revision}:${filePath}`]);
      return stdout;
    } catch {
      return null;
    }
  }

  private async writeFile(relative: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  /** Every file below `prefix`, as POSIX repository-relative paths. */
  private async walk(prefix: string): Promise<string[]> {
    const results: string[] = [];

    const visit = async (relative: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(this.resolve(relative), { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') || SKIP_DIRECTORIES.has(entry.name)) continue;
        const child = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(child);
        else if (entry.isFile()) results.push(child);
      }
    };

    await visit(prefix);
    return results.sort();
  }

  private git(args: string[]): Promise<{ stdout: string }> {
    return run('git', args, {
      cwd: this.config.root,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
  }

  private async hasGit(): Promise<boolean> {
    if (this.gitAvailable === null) {
      this.gitAvailable = await this.git(['rev-parse', '--git-dir']).then(
        () => true,
        () => false,
      );
    }
    return this.gitAvailable;
  }

  private async gitCommit(message: string, paths: readonly string[]): Promise<string | null> {
    if (!(await this.hasGit())) return null;
    try {
      await this.git(['add', '--', ...paths]);
      await this.git(['commit', '--quiet', '--message', message, '--', ...paths]);
      const { stdout } = await this.git(['rev-parse', 'HEAD']);
      return stdout.trim();
    } catch {
      // Nothing staged, or Git has no identity configured. The files are
      // written either way, so this should not fail the request.
      return null;
    }
  }
}
