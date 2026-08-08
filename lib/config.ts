/**
 * Server-side configuration, read once from the environment.
 *
 * This module must never be imported from a Client Component. It reads secrets
 * and is deliberately free of any `NEXT_PUBLIC_` values so that an accidental
 * import surfaces as a build error rather than a leaked token.
 */

import 'server-only';

export type StorageDriver = 'github' | 'filesystem';

export interface GitHubConfig {
  readonly token: string;
  readonly owner: string;
  readonly repository: string;
  readonly branch: string;
  /** Base URL of the REST API; overridable for GitHub Enterprise. */
  readonly apiBaseUrl: string;
}

export interface FilesystemConfig {
  /** Absolute path to the directory that holds the content tree. */
  readonly root: string;
}

export interface Config {
  readonly driver: StorageDriver;
  readonly github: GitHubConfig | null;
  readonly filesystem: FilesystemConfig | null;
  /** Directory inside the repository that holds notes, e.g. `content`. */
  readonly contentDirectory: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigurationError(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/** Strips leading and trailing slashes so paths join predictably. */
function normaliseDirectory(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function resolveDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER?.trim();
  if (explicit === 'github' || explicit === 'filesystem') return explicit;
  // GitHub is the default; the filesystem driver is opt-in for local use.
  return process.env.CONTENT_ROOT ? 'filesystem' : 'github';
}

function build(): Config {
  const driver = resolveDriver();
  const contentDirectory = normaliseDirectory(optional('CONTENT_DIRECTORY', 'content'));

  if (driver === 'filesystem') {
    return {
      driver,
      github: null,
      filesystem: { root: required('CONTENT_ROOT') },
      contentDirectory,
    };
  }

  return {
    driver,
    github: {
      token: required('GITHUB_TOKEN'),
      owner: required('GITHUB_OWNER'),
      repository: required('GITHUB_REPOSITORY'),
      branch: optional('GITHUB_BRANCH', 'main'),
      apiBaseUrl: optional('GITHUB_API_BASE_URL', 'https://api.github.com'),
    },
    filesystem: null,
    contentDirectory,
  };
}

let cached: Config | null = null;

/** Throws {@link ConfigurationError} when the environment is incomplete. */
export function getConfig(): Config {
  cached ??= build();
  return cached;
}

/** Test seam: forget the memoised configuration. */
export function resetConfigForTests(): void {
  cached = null;
}
