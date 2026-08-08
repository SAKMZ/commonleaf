import type { TextFile } from '../storage/types';
import { parseNote, type Frontmatter } from './frontmatter';
import { countWords, excerptOf, readingMinutes } from './markdown-text';
import { baseNameOf, folderOf, slugFromPath, titleFromSlug } from './paths';
import { extractInlineTags } from './tags';
import { extractWikiLinks, type WikiLink } from './wikilinks';

/**
 * A note, as the rest of the application sees it.
 *
 * Everything here is derived from one Markdown file. Nothing is stored that
 * the file does not already say, which is what keeps the promise that the
 * vault is the whole truth and the application is disposable.
 */
export interface Note {
  /** Repository-relative path, including the content directory. */
  readonly path: string;
  /** Identifier and URL: `books/atomic-habits`. */
  readonly slug: string;
  /** Containing folder, `''` at the top level. */
  readonly folder: string;
  /** File name without extension. */
  readonly name: string;
  readonly title: string;
  readonly frontmatter: Frontmatter;
  /** Markdown body, frontmatter removed. */
  readonly body: string;
  /** Git blob SHA, carried into the editor for conflict detection. */
  readonly sha: string;
  /** Frontmatter tags and inline tags, merged and de-duplicated. */
  readonly tags: readonly string[];
  readonly links: readonly WikiLink[];
  readonly excerpt: string;
  readonly wordCount: number;
  /** Minutes, taken from frontmatter when set and computed when not. */
  readonly readingTime: number;
}

export function buildNote(file: TextFile, contentDirectory: string): Note | null {
  const slug = slugFromPath(file.path, contentDirectory);
  if (!slug) return null;

  const { frontmatter, body } = parseNote(file.content, titleFromSlug(slug));
  const wordCount = countWords(body);

  return {
    path: file.path,
    slug,
    folder: folderOf(slug),
    name: baseNameOf(slug),
    title: frontmatter.title,
    frontmatter,
    body,
    sha: file.sha,
    tags: [...new Set([...frontmatter.tags, ...extractInlineTags(body)])].sort(),
    links: extractWikiLinks(body),
    excerpt: excerptOf(body),
    wordCount,
    readingTime: frontmatter.reading_time ?? readingMinutes(wordCount),
  };
}

/**
 * When the note was last touched, for sorting.
 *
 * `updated` is written on every save; `date` is the fallback for notes brought
 * in from elsewhere that only record when they were created.
 */
export function lastTouched(note: Note): string {
  return note.frontmatter.updated || note.frontmatter.date || '';
}

/** Newest first, with an alphabetical tiebreak so ordering is never arbitrary. */
export function byRecency(a: Note, b: Note): number {
  const difference = lastTouched(b).localeCompare(lastTouched(a));
  return difference !== 0 ? difference : a.title.localeCompare(b.title);
}

export function byTitle(a: Note, b: Note): number {
  return a.title.localeCompare(b.title);
}
