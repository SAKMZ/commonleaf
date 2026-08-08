import { lineContaining, toPlainText, withoutCode } from './markdown-text';

/**
 * Wiki links: `[[Target]]`, `[[Target|Label]]`, `[[Target#Heading]]`.
 *
 * The point of the syntax is that you write the *name* of the thing you mean
 * and worry about where it lives later. Resolution is therefore forgiving —
 * see `resolveKeys` — and a link to a note that does not exist yet is a normal
 * state, not an error. It renders differently and can be turned into a real
 * note in one click.
 */

export interface WikiLink {
  /** What was written before any `#` or `|`. */
  readonly target: string;
  /** The heading fragment, without the `#`. */
  readonly heading: string | null;
  /** The display text after `|`, if any. */
  readonly label: string | null;
  /** Character offset in the body, used to quote the surrounding line. */
  readonly index: number;
}

/**
 * Targets may not contain `[`, `]` or `|`. The lazy heading and label groups
 * keep `[[A#B|C]]` from swallowing the closing brackets.
 */
const WIKILINK = /\[\[([^[\]|#]+)(?:#([^[\]|]+))?(?:\|([^[\]]*))?\]\]/g;

export function extractWikiLinks(body: string): WikiLink[] {
  // Links inside code samples are being shown, not made.
  const searchable = withoutCode(body);
  const links: WikiLink[] = [];

  for (const match of searchable.matchAll(WIKILINK)) {
    const target = match[1].trim();
    if (target === '') continue;

    links.push({
      target,
      heading: match[2]?.trim() || null,
      label: match[3]?.trim() || null,
      index: match.index,
    });
  }

  return links;
}

/** The text shown for a link when it is rendered. */
export function displayText(link: WikiLink): string {
  if (link.label) return link.label;
  return link.heading ? `${link.target} § ${link.heading}` : link.target;
}

/**
 * The key a target is looked up by.
 *
 * Case, surrounding whitespace and the difference between spaces and hyphens
 * are all things a person should not have to get right when writing a link, so
 * they are normalised away. `[[Atomic Habits]]`, `[[atomic habits]]` and
 * `[[atomic-habits]]` all find the same note.
 */
export function linkKey(text: string): string {
  return text
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

/**
 * The quoted line shown beneath a backlink.
 *
 * Reduced to plain prose: a mention is quoted so the reader can see how the
 * note was used, and leaving `[[double brackets]]` in the quotation shows them
 * the markup rather than the sentence.
 */
export function contextFor(body: string, link: WikiLink): string {
  return toPlainText(lineContaining(withoutCode(body), link.index));
}
