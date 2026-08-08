import type { IFuseOptions } from 'fuse.js';

import type { SearchDocument } from './documents';

/**
 * Fuzzy search over the notebook.
 *
 * The weights encode what a person means when they half-remember a note: the
 * title is what they reach for first, then the tag they filed it under, then
 * the folder, and only then the words in it. `threshold` is deliberately tight
 * — a commonplace book is searched to find a specific thing, and a list padded
 * with near-misses is worse than a short list.
 */
export const SEARCH_OPTIONS: IFuseOptions<SearchDocument> = {
  keys: [
    { name: 'title', weight: 10 },
    { name: 'tags', weight: 4 },
    { name: 'folder', weight: 2 },
    { name: 'excerpt', weight: 1 },
  ],
  threshold: 0.34,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
};

export interface Searcher {
  search(query: string, limit: number): SearchDocument[];
}

/**
 * Loads Fuse.js and indexes the documents.
 *
 * The import is dynamic so that the library is fetched the first time someone
 * opens the palette rather than on every page load. Readers who never search
 * never pay for it.
 */
export async function createSearcher(documents: readonly SearchDocument[]): Promise<Searcher> {
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse([...documents], SEARCH_OPTIONS);

  return {
    search(query, limit) {
      const trimmed = query.trim();
      // An empty query means "show me the notebook", not "show me nothing".
      if (trimmed === '') return [...documents].slice(0, limit);

      return fuse.search(trimmed, { limit }).map((result) => result.item);
    },
  };
}
