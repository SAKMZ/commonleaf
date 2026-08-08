/**
 * Translating between the three ways a note is addressed.
 *
 *   file path   `content/books/atomic-habits.md`   what Git stores
 *   slug        `books/atomic-habits`              what the app and URLs use
 *   title       `Atomic Habits`                    what the reader sees
 *
 * The slug is the identifier. It is derived from the file path rather than
 * stored anywhere, so moving a file in any editor moves the note, and nothing
 * has to be kept in sync.
 */

export const MARKDOWN_EXTENSION = '.md';

/** Where daily notes live, relative to the content directory. */
export const DAILY_FOLDER = 'daily';

/** Where pasted and dropped images are written. */
export const IMAGE_FOLDER = 'images';

/** Characters no filesystem, URL or Git host is happy about. */
const UNSAFE_CHARACTERS = /["*/:<>?\\|#%{}^[\]`]/g;

/**
 * Written as a loop rather than a regular expression: a character class of
 * control characters is easy to corrupt in an editor and hard to review.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(MARKDOWN_EXTENSION);
}

/** Joins path segments, dropping empty ones and collapsing separators. */
export function joinPath(...segments: string[]): string {
  return segments
    .filter((segment) => segment !== '')
    .join('/')
    .replace(/\/{2,}/g, '/');
}

/**
 * Rejects anything that could escape the content directory.
 *
 * Slugs arrive from URLs and from note bodies, so this runs on every lookup
 * rather than only on writes. Returning `null` rather than throwing lets
 * callers answer with a 404, which is what a bad slug deserves.
 */
export function normaliseSlug(slug: string): string | null {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // A malformed percent-escape is not a path worth trying to rescue.
    return null;
  }

  const cleaned = decoded
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');

  if (cleaned === '') return null;
  if (hasControlCharacter(cleaned)) return null;
  if (cleaned.split('/').some((segment) => segment === '.' || segment === '..')) return null;

  return cleaned;
}

export function slugFromPath(path: string, contentDirectory: string): string | null {
  if (!isMarkdownPath(path)) return null;

  const prefix = contentDirectory === '' ? '' : `${contentDirectory}/`;
  if (!path.startsWith(prefix)) return null;

  return path.slice(prefix.length, -MARKDOWN_EXTENSION.length) || null;
}

export function pathFromSlug(slug: string, contentDirectory: string): string {
  return `${joinPath(contentDirectory, slug)}${MARKDOWN_EXTENSION}`;
}

export function folderOf(slug: string): string {
  const index = slug.lastIndexOf('/');
  return index === -1 ? '' : slug.slice(0, index);
}

export function baseNameOf(slug: string): string {
  const index = slug.lastIndexOf('/');
  return index === -1 ? slug : slug.slice(index + 1);
}

/**
 * Turns a title into a file name.
 *
 * Letters and numbers in any script are kept, so a note called `Café` becomes
 * `café` rather than a row of hyphens. Only characters that genuinely cause
 * trouble in a path or a URL are removed.
 */
export function slugifySegment(text: string): string {
  const cleaned = text
    .normalize('NFC')
    .replace(UNSAFE_CHARACTERS, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();

  // A title made entirely of punctuation would otherwise produce an empty name.
  return cleaned === '' ? 'untitled' : cleaned;
}

/** Slugifies each segment of a `folder/name` path, preserving the folders. */
export function slugifyPath(text: string): string {
  const segments = text
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => slugifySegment(segment));

  return segments.length === 0 ? 'untitled' : segments.join('/');
}

/**
 * A readable title for a note whose frontmatter has none.
 *
 * `books/atomic-habits` becomes `Atomic Habits`. Dates are left alone, because
 * `2026-08-07` reads better than `2026 08 07`.
 */
export function titleFromSlug(slug: string): string {
  const base = baseNameOf(slug);
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;

  return base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\p{Ll}/gu, (letter) => letter.toUpperCase());
}
