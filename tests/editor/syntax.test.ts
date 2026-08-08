import { parser as baseParser } from '@lezer/markdown';
import { describe, expect, it } from 'vitest';

import { markdownSyntaxExtensions } from '@/lib/editor/markdown-syntax';

/**
 * The parser extensions are what make wiki links and tags aware of code spans
 * and fenced blocks for free. Testing the tree directly — rather than the
 * decorations built from it — keeps these tests fast and free of a DOM.
 */

const parser = baseParser.configure(markdownSyntaxExtensions);

/** Every node of `type` in `text`, as the source it covers. */
function nodes(text: string, type: string): string[] {
  const found: string[] = [];
  const tree = parser.parse(text);

  tree.iterate({
    enter(node) {
      if (node.name === type) found.push(text.slice(node.from, node.to));
    },
  });

  return found;
}

describe('wiki link syntax', () => {
  it('recognises a plain link', () => {
    expect(nodes('See [[Stoicism]] tonight.', 'WikiLink')).toEqual(['[[Stoicism]]']);
  });

  it('recognises labels and headings', () => {
    expect(nodes('[[Note#Part|label]]', 'WikiLink')).toEqual(['[[Note#Part|label]]']);
  });

  it('marks both pairs of brackets', () => {
    expect(nodes('[[Target]]', 'WikiLinkMark')).toEqual(['[[', ']]']);
  });

  it('ignores one inside a code span', () => {
    expect(nodes('Write `[[Target]]` to link.', 'WikiLink')).toEqual([]);
  });

  it('ignores one inside a fenced block', () => {
    expect(nodes('```\n[[Target]]\n```\n', 'WikiLink')).toEqual([]);
  });

  it('ignores an unclosed or empty link', () => {
    expect(nodes('[[Unclosed', 'WikiLink')).toEqual([]);
    expect(nodes('[[]]', 'WikiLink')).toEqual([]);
  });

  it('leaves an ordinary Markdown link alone', () => {
    expect(nodes('[text](https://example.com)', 'WikiLink')).toEqual([]);
    expect(nodes('[text](https://example.com)', 'Link')).toEqual([
      '[text](https://example.com)',
    ]);
  });

  it('works inside emphasis and list items', () => {
    expect(nodes('*see [[Target]]*', 'WikiLink')).toEqual(['[[Target]]']);
    expect(nodes('- see [[Target]]', 'WikiLink')).toEqual(['[[Target]]']);
  });
});

describe('hashtag syntax', () => {
  it('recognises a nested tag', () => {
    expect(nodes('Filed under #books/philosophy today.', 'Hashtag')).toEqual([
      '#books/philosophy',
    ]);
  });

  it('recognises a tag after an opening bracket', () => {
    expect(nodes('(#ideas)', 'Hashtag')).toEqual(['#ideas']);
  });

  it('ignores a heading', () => {
    expect(nodes('# Heading', 'Hashtag')).toEqual([]);
  });

  it('ignores an issue reference', () => {
    expect(nodes('Fixes #42 today', 'Hashtag')).toEqual([]);
  });

  it('ignores a URL fragment', () => {
    expect(nodes('See example.com/page#section', 'Hashtag')).toEqual([]);
  });

  it('ignores one inside code', () => {
    expect(nodes('Write `#python/web` for that.', 'Hashtag')).toEqual([]);
  });
});
