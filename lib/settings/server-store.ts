import 'server-only';

import { getStorage } from '../storage';
import {
  parseStoredSettings,
  sameSettings,
  serialiseStoredSettings,
  SETTINGS_PATH,
  type StoredSettings,
} from './document';
import type { Settings } from './types';

/**
 * The settings file, read and written through the storage port.
 *
 * Cached against the driver's revision token for the same reason the note
 * index is: the root layout asks for it on every render, and on GitHub an
 * uncached read would be an API request per page. The cache lives on
 * `globalThis` so it survives development's module reloads.
 */

interface CacheEntry {
  revision: string;
  stored: StoredSettings | null;
}

const CACHE_KEY = Symbol.for('commonleaf.settings');

type CacheHolder = { [CACHE_KEY]?: CacheEntry | null };

function cache(): CacheHolder {
  return globalThis as unknown as CacheHolder;
}

/**
 * What the notebook says about how it should be read, if it says anything.
 *
 * Never throws. It is called from the root layout, which renders on every
 * route including the error pages, and an unreachable repository must degrade
 * to the built-in defaults rather than take the whole application down with
 * it. A notebook with no settings file is the ordinary case, not a fault.
 */
export async function readStoredSettings(): Promise<StoredSettings | null> {
  try {
    const storage = getStorage();
    const revision = await storage.revision();

    const cached = cache()[CACHE_KEY];
    if (cached && cached.revision === revision) return cached.stored;

    const file = await storage.read(SETTINGS_PATH);
    const stored = file ? parseStoredSettings(file.content) : null;

    cache()[CACHE_KEY] = { revision, stored };
    return stored;
  } catch {
    return null;
  }
}

/**
 * Records the reader's preferences in the notebook.
 *
 * The timestamp is the server's, not the browser's, so that two devices are
 * compared by one clock rather than by two that disagree.
 *
 * A write that changes nothing is not a write. The timestamp alone would make
 * every request a real diff and therefore a real commit, so settling on a
 * theme by trying three and coming back to the first would leave three commits
 * describing one decision. The comparison is against a cached read, so it
 * costs nothing on the common path.
 */
export async function writeStoredSettings(settings: Settings): Promise<StoredSettings> {
  const current = await readStoredSettings();
  if (current && sameSettings(current.settings, settings)) return current;

  const stored: StoredSettings = { settings, updatedAt: Date.now() };

  await getStorage().commit('Update settings', [
    { kind: 'write', path: SETTINGS_PATH, content: serialiseStoredSettings(stored) },
  ]);

  cache()[CACHE_KEY] = null;
  return stored;
}
