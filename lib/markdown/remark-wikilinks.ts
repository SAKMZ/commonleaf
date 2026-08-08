import type { Link, Parent, PhrasingContent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import { displayText, type WikiLink } from '../notes/wikilinks';

/**
 * Turns `[[Target]]` into a real link node.
 *
 * Doing this in remark rather than with a string replacement means wiki links
 * inherit everything Markdown already knows: they are skipped inside code
 * spans and fenced blocks, they nest correctly inside emphasis and list items,
 * and the rest of the pipeline sees an ordinary link.
 */

export interface WikiLinkResolution {
  /** Where the link should point. */
  href: string;
  /** Renders differently when the note has not been written yet. */
  missing: boolean;
}

export interface WikiLinkOptions {
  resolve: (link: WikiLink) => WikiLinkResolution;
}

/** Kept in step with `lib/notes/wikilinks.ts`; see the note there on the groups. */
const WIKILINK = /\[\[([^[\]|#]+)(?:#([^[\]|]+))?(?:\|([^[\]]*))?\]\]/g;

export const remarkWikiLinks: Plugin<[WikiLinkOptions], Root> = ({ resolve }) => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || !node.value.includes('[[')) return;

      const replacement = splitTextNode(node.value, resolve);
      if (!replacement) return;

      parent.children.splice(index, 1, ...replacement);
      // Continue after the nodes just inserted rather than re-reading them.
      return index + replacement.length;
    });
  };
};

function splitTextNode(
  value: string,
  resolve: (link: WikiLink) => WikiLinkResolution,
): PhrasingContent[] | null {
  const nodes: PhrasingContent[] = [];
  let cursor = 0;

  for (const match of value.matchAll(WIKILINK)) {
    const target = match[1].trim();
    if (target === '') continue;

    if (match.index > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, match.index) });
    }

    const link: WikiLink = {
      target,
      heading: match[2]?.trim() || null,
      label: match[3]?.trim() || null,
      index: match.index,
    };
    const { href, missing } = resolve(link);

    nodes.push({
      type: 'link',
      url: href,
      title: null,
      children: [{ type: 'text', value: displayText(link) }],
      data: {
        hProperties: {
          className: ['wikilink'],
          'data-missing': String(missing),
          // Screen readers should hear that this is a link to a page that does
          // not exist yet, not just a differently-coloured link.
          ...(missing ? { 'aria-description': 'Note not created yet' } : {}),
        },
      },
    } satisfies Link);

    cursor = match.index + match[0].length;
  }

  if (nodes.length === 0) return null;
  if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });

  return nodes;
}
