/**
 * The storage port.
 *
 * Everything above this interface — notes, search, backlinks, the UI — is
 * unaware of where files live. `github.ts` is the driver you get by default;
 * `filesystem.ts` exists so the app can run against a local directory during
 * development, in tests, and in self-hosted Docker deployments.
 *
 * Paths are always repository-relative, POSIX style, without a leading slash:
 * `content/books/atomic-habits.md`.
 */

/** A file's identity, addressed the way Git addresses it. */
export interface FileEntry {
  readonly path: string;
  /** Git blob SHA-1. Stable for identical content, and used for conflicts. */
  readonly sha: string;
  readonly size: number;
}

export interface TextFile extends FileEntry {
  readonly content: string;
}

export interface BinaryFile extends FileEntry {
  readonly bytes: Uint8Array;
}

/**
 * A single change within a commit. Grouping changes lets a rename, or a note
 * plus the image pasted into it, land as one revision rather than several.
 */
export type Change =
  | {
      readonly kind: 'write';
      readonly path: string;
      readonly content: string;
      /**
       * The blob SHA the editor started from. When present the driver refuses
       * the write if the file has since changed. `null` asserts the file does
       * not exist yet; `undefined` skips the check entirely.
       */
      readonly expectedSha?: string | null;
    }
  | {
      readonly kind: 'write-binary';
      readonly path: string;
      readonly bytes: Uint8Array;
    }
  | { readonly kind: 'delete'; readonly path: string }
  | { readonly kind: 'move'; readonly from: string; readonly to: string };

export interface CommitResult {
  /** Commit SHA, or `null` when the change was a no-op. */
  readonly sha: string | null;
  /** Blob SHAs of the files written, keyed by path. */
  readonly blobs: Readonly<Record<string, string>>;
}

export interface Revision {
  readonly sha: string;
  readonly message: string;
  readonly author: string;
  /** ISO 8601. */
  readonly date: string;
}

/** Raised when a write is based on a version that is no longer current. */
export class ConflictError extends Error {
  constructor(
    readonly path: string,
    readonly expectedSha: string | null | undefined,
    readonly actualSha: string | null,
  ) {
    super(
      `"${path}" changed since it was opened. Reload before saving to avoid overwriting the newer version.`,
    );
    this.name = 'ConflictError';
  }
}

/** Raised when the driver cannot reach or authenticate against its backend. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}

/** Raised by drivers that cannot provide an optional capability. */
export class UnsupportedOperationError extends Error {
  constructor(operation: string) {
    super(`This storage driver does not support ${operation}.`);
    this.name = 'UnsupportedOperationError';
  }
}

export interface Storage {
  /**
   * An opaque token identifying the current state of the whole tree. The note
   * index caches against it, so it must change whenever any file changes and
   * must be cheap to compute.
   */
  revision(): Promise<string>;

  /** Every text file under `prefix`, read in one pass. Used to build the index. */
  readTree(prefix: string): Promise<TextFile[]>;

  read(path: string): Promise<TextFile | null>;

  readBinary(path: string): Promise<BinaryFile | null>;

  /** Applies `changes` atomically and returns the resulting commit. */
  commit(message: string, changes: readonly Change[]): Promise<CommitResult>;

  /** Most recent revisions touching `path`, newest first. */
  history(path: string, limit: number): Promise<Revision[]>;

  /** File contents as of `revision`, or `null` if it did not exist then. */
  readAtRevision(path: string, revision: string): Promise<string | null>;
}
