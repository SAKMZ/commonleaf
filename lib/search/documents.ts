import type { NoteCollection } from '../notes/collection';

/**
 * A note reduced to what search needs.
 *
 * These travel to the browser, so the shape is deliberately mean: no bodies, no
 * frontmatter, no links. A thousand notes cost well under a megabyte this way,
 * which is what makes searching feel instant without a server round trip per
 * keystroke — and without a search index living anywhere but in memory.
 */
export interface SearchDocument {
  readonly slug: string;
  readonly title: string;
  readonly folder: string;
  readonly tags: readonly string[];
  /** First line or so of prose, shown under the title in results. */
  readonly excerpt: string;
  /** ISO 8601, used to break ties towards what was written most recently. */
  readonly updated: string;
}

export function buildSearchDocuments(collection: NoteCollection): SearchDocument[] {
  return collection.notes.map((note) => ({
    slug: note.slug,
    title: note.title,
    folder: note.folder,
    tags: note.tags,
    excerpt: note.excerpt,
    updated: note.frontmatter.updated || note.frontmatter.date || '',
  }));
}
