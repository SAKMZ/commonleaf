import { describe, expect, it } from 'vitest';

import { excerptOf, readingMinutes, toPlainText, withoutCode } from '@/lib/notes/markdown-text';
import { buildTagTree, extractInlineTags, tagLineage } from '@/lib/notes/tags';
import { displayText, extractWikiLinks, linkKey } from '@/lib/notes/wikilinks';

describe('extractWikiLinks', () => {
  it('reads the three forms', () => {
    const links = extractWikiLinks('[[Plain]] [[Target|Label]] [[Note#Heading]]');

    expect(links).toMatchObject([
      { target: 'Plain', heading: null, label: null },
      { target: 'Target', heading: null, label: 'Label' },
      { target: 'Note', heading: 'Heading', label: null },
    ]);
  });

  it('reads a heading and a label together', () => {
    expect(extractWikiLinks('[[Note#Part Two|see there]]')[0]).toMatchObject({
      target: 'Note',
      heading: 'Part Two',
      label: 'see there',
    });
  });

  it('ignores links inside code spans and fences', () => {
    expect(extractWikiLinks('Use `[[Example]]` like this.')).toEqual([]);
    expect(extractWikiLinks('```\n[[Example]]\n```\n')).toEqual([]);
  });

  it('ignores an empty target', () => {
    expect(extractWikiLinks('[[]] and [[   ]]')).toEqual([]);
  });

  it('records where each link was found', () => {
    const [link] = extractWikiLinks('Some prose [[Target]] more prose.');

    expect(link.index).toBe('Some prose '.length);
  });

  it('chooses display text in the order label, heading, target', () => {
    expect(displayText({ target: 'T', heading: null, label: 'L', index: 0 })).toBe('L');
    expect(displayText({ target: 'T', heading: 'H', label: null, index: 0 })).toBe('T § H');
    expect(displayText({ target: 'T', heading: null, label: null, index: 0 })).toBe('T');
  });
});

describe('linkKey', () => {
  it('makes case, spacing and hyphens irrelevant', () => {
    expect(linkKey('Atomic Habits')).toBe(linkKey('atomic-habits'));
    expect(linkKey('  Deep_Work ')).toBe(linkKey('deep work'));
  });
});

describe('extractInlineTags', () => {
  it('finds nested tags', () => {
    expect(extractInlineTags('Filed under #books/philosophy today.')).toEqual([
      'books/philosophy',
    ]);
  });

  it('ignores headings', () => {
    expect(extractInlineTags('# Heading\n\n## Another')).toEqual([]);
  });

  it('ignores issue references and URL fragments', () => {
    expect(extractInlineTags('Fixes #42 in example.com/page#section')).toEqual([]);
  });

  it('ignores tags inside code', () => {
    expect(extractInlineTags('Write `#python/web` for that.')).toEqual([]);
  });

  it('finds a tag after an opening bracket', () => {
    expect(extractInlineTags('(#ideas)')).toEqual(['ideas']);
  });

  it('de-duplicates', () => {
    expect(extractInlineTags('#ideas and more #ideas')).toEqual(['ideas']);
  });
});

describe('buildTagTree', () => {
  it('counts a tag against every ancestor exactly once', () => {
    // This note carries both a parent and its child; `books` must count once.
    const tree = buildTagTree([['books', 'books/philosophy']]);

    expect(tree[0]).toMatchObject({ path: 'books', count: 1, totalCount: 1 });
    expect(tree[0].children[0]).toMatchObject({ path: 'books/philosophy', count: 1 });
  });

  it('separates exact counts from totals', () => {
    const tree = buildTagTree([['books/philosophy'], ['books/fiction'], ['books']]);

    expect(tree[0].count).toBe(1);
    expect(tree[0].totalCount).toBe(3);
  });

  it('sorts alphabetically at each level', () => {
    const tree = buildTagTree([['zeta'], ['alpha'], ['alpha/two'], ['alpha/one']]);

    expect(tree.map((node) => node.name)).toEqual(['alpha', 'zeta']);
    expect(tree[0].children.map((node) => node.name)).toEqual(['one', 'two']);
  });
});

describe('tagLineage', () => {
  it('lists every ancestor including the tag itself', () => {
    expect(tagLineage('a/b/c')).toEqual(['a', 'a/b', 'a/b/c']);
  });
});

describe('markdown text', () => {
  it('removes fenced blocks, including unclosed ones', () => {
    expect(withoutCode('before\n```js\ncode()\n```\nafter')).not.toContain('code()');
    expect(withoutCode('before\n```\nrunaway')).not.toContain('runaway');
  });

  it('reduces Markdown to readable prose', () => {
    const text = toPlainText(
      '# Heading\n\n> A quote with **bold** and [a link](https://example.com).\n\n- item one\n- [ ] a task',
    );

    expect(text).toBe('Heading A quote with bold and a link. item one a task');
  });

  it('keeps the label of a wiki link', () => {
    expect(toPlainText('See [[Target|the label]].')).toBe('See the label.');
    expect(toPlainText('See [[Target]].')).toBe('See Target.');
  });

  it('cuts an excerpt at a word boundary', () => {
    const excerpt = excerptOf(`${'word '.repeat(60)}end`, 60);

    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).not.toMatch(/wo…$/);
    expect(excerpt.length).toBeLessThanOrEqual(61);
  });

  it('leaves short text alone', () => {
    expect(excerptOf('Short enough.')).toBe('Short enough.');
  });

  it('estimates reading time, and claims none for an empty note', () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
  });
});
