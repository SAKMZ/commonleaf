import type { NoteCollection } from './collection';
import type { WikiLinkResolution } from '../markdown/remark-wikilinks';
import { folderOf, slugifyPath } from './paths';
import type { WikiLink } from './wikilinks';

/**
 * URLs. Kept in one place so that changing the shape of a route is a one-file
 * change rather than a search across every component.
 */
function encodeSlug(slug: string): string {
  return slug.split('/').map(encodeURIComponent).join('/');
}

export const routes = {
  home: '/',
  note: (slug: string) => `/notes/${encodeSlug(slug)}`,
  /**
   * Editing and history live under their own prefixes rather than at
   * `/notes/<slug>/edit`, because a catch-all segment cannot have routes
   * nested inside it.
   */
  edit: (slug: string) => `/edit/${encodeSlug(slug)}`,
  history: (slug: string) => `/history/${encodeSlug(slug)}`,
  tag: (tag: string) => `/tags/${encodeSlug(tag)}`,
  tags: '/tags',
  folder: (folder: string) => `/folders/${encodeSlug(folder)}`,
  favorites: '/favorites',
  /** Wiki links pointing at notes nobody has written yet. */
  unwritten: '/unwritten',
  settings: '/settings',
  /** Redirects to a note chosen at random; not a page of its own. */
  random: '/random',
  /**
   * Opens the entry for a day, writing it first if it does not exist.
   *
   * The date is a parameter because only the browser knows what "today" means
   * for the reader — the server may be in another timezone entirely.
   */
  daily: (isoDate: string) => `/daily?date=${encodeURIComponent(isoDate)}`,
} as const;

/** Prefixes whose remainder is a note slug. */
const SLUG_PREFIXES = ['/notes/', '/edit/', '/history/'];

/**
 * The note a URL is about, if it is about one.
 *
 * Reading it back out of the path — rather than threading the slug down
 * through props — means anything mounted in the shell can ask "which note is
 * on screen?" without the pages having to tell it.
 */
export function slugFromPathname(pathname: string): string | null {
  const prefix = SLUG_PREFIXES.find((candidate) => pathname.startsWith(candidate));
  if (!prefix) return null;

  const slug = pathname.slice(prefix.length).split('/').map(decodeURIComponent).join('/');

  return slug === '' ? null : slug;
}

/**
 * The folder a URL is standing in.
 *
 * Used to file a new note where the writer already is: starting one while
 * reading `philosophy/stoicism`, or while looking at the `philosophy` folder,
 * puts it in `philosophy`. Anywhere else it is the root, which is also the
 * honest answer — there is no folder in view to mean anything else.
 */
export function folderFromPathname(pathname: string): string {
  if (pathname.startsWith('/folders/')) {
    return pathname.slice('/folders/'.length).split('/').map(decodeURIComponent).join('/');
  }

  const slug = slugFromPathname(pathname);
  return slug ? folderOf(slug) : '';
}

/**
 * Builds the wiki-link resolver the renderer needs.
 *
 * A link to a note that does not exist still gets a URL — the slug the note
 * *would* have — so that following it can offer to create it. That is what
 * makes an unwritten link a next step rather than a dead end.
 */
export function wikiLinkResolver(
  collection: NoteCollection,
): (link: WikiLink) => WikiLinkResolution {
  return (link) => {
    const note = collection.resolve(link.target);
    const slug = note?.slug ?? slugifyPath(link.target);
    const fragment = link.heading ? `#${slugifyPath(link.heading)}` : '';

    return { href: `${routes.note(slug)}${fragment}`, missing: !note };
  };
}
