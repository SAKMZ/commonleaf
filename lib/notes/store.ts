import 'server-only';

import { getConfig } from '../config';
import { getStorage } from '../storage';
import { NoteCollection } from './collection';
import { buildNote } from './note';

/**
 * Reads the notebook, and remembers it until it changes.
 *
 * Rebuilding the index means reading every note, which is one archive download
 * against GitHub. Doing that per request would be wasteful and slow, so the
 * result is cached against the storage driver's revision token: one cheap call
 * confirms nothing has changed, and the cached collection is reused.
 *
 * The cache lives on `globalThis` so it survives the module reloads that
 * happen constantly in development. In production it is per server instance —
 * on Vercel, per serverless instance — which is correct but not shared. For a
 * personal notebook that is the right trade: no infrastructure, no staleness.
 */

interface CacheEntry {
  revision: string;
  collection: NoteCollection;
}

const CACHE_KEY = Symbol.for('commonleaf.noteIndex');

type CacheHolder = { [CACHE_KEY]?: CacheEntry | null };

function cache(): CacheHolder {
  return globalThis as unknown as CacheHolder;
}

export async function getNotes(): Promise<NoteCollection> {
  const storage = getStorage();
  const { contentDirectory } = getConfig();

  const revision = await storage.revision();
  const cached = cache()[CACHE_KEY];
  if (cached && cached.revision === revision) return cached.collection;

  const files = await storage.readTree(contentDirectory);
  const notes = files
    .map((file) => buildNote(file, contentDirectory))
    .filter((note): note is NonNullable<typeof note> => note !== null);

  const collection = new NoteCollection(notes);
  cache()[CACHE_KEY] = { revision, collection };
  return collection;
}

/**
 * Forgets the cached index.
 *
 * Called after a write so the next read reflects it immediately. Without this
 * the reader would see their own edit appear only once the revision token
 * caught up, which reads as a bug even though it is only a cache.
 */
export function invalidateNotes(): void {
  cache()[CACHE_KEY] = null;
}
