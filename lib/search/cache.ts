import { api, onMutation } from '../api/client';
import { createSearcher, type Searcher } from './searcher';

/**
 * The search index, fetched once per page.
 *
 * Downloading it on every ⌘K would be wasteful, and rebuilding the Fuse index
 * on every keystroke more so. Holding the *promise* rather than the result
 * means two rapid opens share one request instead of racing.
 *
 * It is thrown away whenever a write goes through the API client, so a note
 * created from the palette is findable in the palette a moment later.
 */

let pending: Promise<Searcher> | null = null;
let listening = false;

export function loadSearcher(): Promise<Searcher> {
  if (!listening) {
    listening = true;
    onMutation(invalidateSearchIndex);
  }

  pending ??= api
    .searchIndex()
    .then(({ documents }) => createSearcher(documents))
    .catch((error: unknown) => {
      // A failed load must not be cached, or the palette stays broken until
      // the page is reloaded.
      pending = null;
      throw error;
    });

  return pending;
}

export function invalidateSearchIndex(): void {
  pending = null;
}
