import 'server-only';

import { getConfig } from '../config';
import { FilesystemStorage } from './filesystem';
import { GitHubStorage } from './github';
import type { Storage } from './types';

export * from './types';

let instance: Storage | null = null;

/**
 * The configured storage driver.
 *
 * Memoised because both drivers are stateless apart from small caches, and
 * because constructing one validates the environment exactly once.
 */
export function getStorage(): Storage {
  if (instance) return instance;

  const config = getConfig();
  instance =
    config.driver === 'filesystem'
      ? new FilesystemStorage(config.filesystem!)
      : new GitHubStorage(config.github!);

  return instance;
}

/** Test seam: replace or clear the memoised driver. */
export function setStorageForTests(storage: Storage | null): void {
  instance = storage;
}
