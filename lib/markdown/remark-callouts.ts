import type { Blockquote, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Callouts, in the syntax Obsidian popularised:
 *
 *     > [!note] An optional title
 *     > The body of the callout.
 *
 * Chosen over inventing a syntax because a vault should stay portable — a note
 * written here opens correctly elsewhere, and a note written elsewhere opens
 * correctly here. A callout whose type we do not recognise still renders as a
 * plain blockquote, which is exactly what an unsupported callout should do.
 */

export const CALLOUT_TYPES = [
  'note',
  'quote',
  'idea',
  'question',
  'warning',
  'summary',
  'example',
] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

const MARKER = /^\[!([a-z]+)\][ \t]*(.*)$/i;

export const remarkCallouts: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0];
      if (first?.type !== 'paragraph') return;

      const opening = first.children[0];
      if (opening?.type !== 'text') return;

      const [line, ...rest] = opening.value.split('\n');
      const match = MARKER.exec(line.trim());
      if (!match) return;

      const type = match[1].toLowerCase();
      const title = match[2].trim();

      // Put back whatever followed the marker on the same paragraph.
      const remainder = rest.join('\n');
      if (remainder === '') first.children.shift();
      else opening.value = remainder;
      if (first.children.length === 0) node.children.shift();

      node.data = {
        ...node.data,
        hName: 'div',
        hProperties: {
          className: ['callout', `callout-${type}`],
          'data-callout': type,
        },
      };

      if (title !== '') {
        node.children.unshift(calloutTitle(title));
      }
    });
  };
};

function calloutTitle(title: string): Paragraph {
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: title }],
    data: { hProperties: { className: ['callout-title'] } },
  };
}
