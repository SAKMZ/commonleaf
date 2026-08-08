import { tags } from '@lezer/highlight';
import type { InlineContext, MarkdownConfig } from '@lezer/markdown';

/**
 * Teaches the Markdown parser about wiki links and hashtags.
 *
 * Both could be found with a regular expression over the document, but adding
 * them to the grammar means they inherit everything the parser already knows:
 * neither is recognised inside a code span or a fenced block, and both nest
 * correctly inside emphasis, list items and quotes. That correctness is free
 * here and would have to be rebuilt by hand otherwise.
 */

const OPEN_BRACKET = 91; // [
const HASH = 35; // #

export const WikiLinkSyntax: MarkdownConfig = {
  defineNodes: [
    { name: 'WikiLink', style: tags.link },
    { name: 'WikiLinkMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'WikiLink',
      // Must run before the ordinary link parser, which would otherwise claim
      // the first `[` and leave a stray bracket behind.
      before: 'Link',
      parse(cx: InlineContext, next: number, pos: number) {
        if (next !== OPEN_BRACKET || cx.char(pos + 1) !== OPEN_BRACKET) return -1;

        const rest = cx.slice(pos + 2, cx.end);
        const close = rest.indexOf(']]');
        if (close < 0) return -1;

        // An unescaped `[` inside means the brackets were never a link.
        const inner = rest.slice(0, close);
        if (inner.includes('[') || inner.trim() === '') return -1;

        const end = pos + 2 + close + 2;
        return cx.addElement(
          cx.elt('WikiLink', pos, end, [
            cx.elt('WikiLinkMark', pos, pos + 2),
            cx.elt('WikiLinkMark', end - 2, end),
          ]),
        );
      },
    },
  ],
};

/** Matches the inline-tag rule in `lib/notes/tags.ts`. */
const TAG_BODY = /^\p{L}[\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_-]+)*/u;

export const HashtagSyntax: MarkdownConfig = {
  defineNodes: [{ name: 'Hashtag', style: tags.tagName }],
  parseInline: [
    {
      name: 'Hashtag',
      parse(cx: InlineContext, next: number, pos: number) {
        if (next !== HASH) return -1;

        // A tag starts a word. Without this, `example.com/#top` and the `#` of
        // a heading would both light up as tags.
        if (pos > cx.offset) {
          const before = cx.slice(pos - 1, pos);
          if (!/[\s(]/.test(before)) return -1;
        }

        const match = TAG_BODY.exec(cx.slice(pos + 1, cx.end));
        if (!match) return -1;

        return cx.addElement(cx.elt('Hashtag', pos, pos + 1 + match[0].length));
      },
    },
  ],
};

export const markdownSyntaxExtensions = [WikiLinkSyntax, HashtagSyntax];
