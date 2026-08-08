import { describe, expect, it } from 'vitest';

import { normaliseTag, parseNote, serialiseNote } from '@/lib/notes/frontmatter';

describe('parseNote', () => {
  it('reads a complete frontmatter block', () => {
    const { frontmatter, body } = parseNote(
      [
        '---',
        'title: Atomic Habits',
        'date: 2026-01-04',
        'updated: 2026-02-11T09:30:00Z',
        'tags: [books/psychology, habits]',
        'favorite: true',
        'source: https://example.com',
        'author: James Clear',
        'aliases: [Atomic Habits Notes]',
        'reading_time: 7',
        '---',
        '',
        'The body.',
      ].join('\n'),
      'Fallback',
    );

    expect(frontmatter).toEqual({
      title: 'Atomic Habits',
      date: '2026-01-04',
      updated: '2026-02-11T09:30:00Z',
      tags: ['books/psychology', 'habits'],
      favorite: true,
      source: 'https://example.com',
      author: 'James Clear',
      aliases: ['Atomic Habits Notes'],
      reading_time: 7,
    });
    expect(body).toBe('The body.');
  });

  it('falls back to the first heading, then to the file name', () => {
    expect(parseNote('# From the heading\n\nBody', 'From the file').frontmatter.title).toBe(
      'From the heading',
    );
    expect(parseNote('Just prose.', 'From the file').frontmatter.title).toBe('From the file');
  });

  it('accepts tags written as a comma-separated string', () => {
    const { frontmatter } = parseNote('---\ntags: books, philosophy\n---\n', 'x');

    expect(frontmatter.tags).toEqual(['books', 'philosophy']);
  });

  it('accepts a single tag', () => {
    expect(parseNote('---\ntags: stoicism\n---\n', 'x').frontmatter.tags).toEqual(['stoicism']);
  });

  it('treats yes and 1 as favorite', () => {
    expect(parseNote('---\nfavorite: yes\n---\n', 'x').frontmatter.favorite).toBe(true);
    expect(parseNote('---\nfavorite: 1\n---\n', 'x').frontmatter.favorite).toBe(true);
    expect(parseNote('---\nfavorite: no\n---\n', 'x').frontmatter.favorite).toBe(false);
  });

  it('survives unparseable YAML instead of losing the note', () => {
    const raw = '---\ntitle: "unterminated\n  bad: [\n---\n\nThe words still matter.';

    const { body } = parseNote(raw, 'Rescued');

    expect(body).toContain('The words still matter.');
  });

  it('reads a date that YAML turned into a Date object', () => {
    // Unquoted `date: 2026-01-04` is parsed by YAML as a timestamp.
    expect(parseNote('---\ndate: 2026-01-04\n---\n', 'x').frontmatter.date).toContain(
      '2026-01-04',
    );
  });

  it('defaults updated to date when only date is present', () => {
    const { frontmatter } = parseNote('---\ntitle: T\ndate: "2026-01-04"\n---\n', 'x');

    expect(frontmatter.updated).toBe('2026-01-04');
  });
});

describe('normaliseTag', () => {
  it('strips a leading hash and lowercases', () => {
    expect(normaliseTag('#Books/Philosophy')).toBe('books/philosophy');
  });

  it('replaces spaces and collapses separators', () => {
    expect(normaliseTag('deep work')).toBe('deep-work');
    expect(normaliseTag('a//b')).toBe('a/b');
    expect(normaliseTag('/leading/')).toBe('leading');
  });
});

describe('serialiseNote', () => {
  const base = {
    title: 'A Note',
    date: '2026-01-04',
    updated: '2026-01-05T10:00:00.000Z',
    tags: ['ideas'],
    favorite: false,
    source: null,
    author: null,
    aliases: [],
    reading_time: null,
  };

  it('omits optional fields that are empty', () => {
    const output = serialiseNote(base, 'Body');

    expect(output).not.toContain('source:');
    expect(output).not.toContain('author:');
    expect(output).not.toContain('aliases:');
    expect(output).not.toContain('reading_time:');
  });

  it('writes keys in a fixed order', () => {
    const output = serialiseNote({ ...base, source: 'https://example.com' }, 'Body');
    const keys = [...output.matchAll(/^(\w+):/gm)].map((match) => match[1]);

    expect(keys).toEqual(['title', 'date', 'updated', 'tags', 'favorite', 'source']);
  });

  it('round-trips without losing anything', () => {
    const full = {
      ...base,
      source: 'https://example.com',
      author: 'A Writer',
      aliases: ['Another Name'],
      reading_time: 4,
    };

    const { frontmatter, body } = parseNote(serialiseNote(full, '# Heading\n\nProse.'), 'x');

    expect(frontmatter).toEqual(full);
    expect(body).toBe('# Heading\n\nProse.');
  });

  it('is byte-stable, so saving twice produces no diff', () => {
    const once = serialiseNote(base, 'Body');
    const parsed = parseNote(once, 'x');

    expect(serialiseNote(parsed.frontmatter, parsed.body)).toBe(once);
  });

  it('normalises trailing whitespace and line endings', () => {
    expect(serialiseNote(base, 'Body\n\n\n  ')).toMatch(/Body\n$/);
    expect(serialiseNote(base, 'A\r\nB')).not.toContain('\r');
  });

  // Saving must not restyle a file a person wrote by hand, and every other
  // tool that touches Markdown leaves this line blank.
  it('leaves a blank line between the frontmatter and the body', () => {
    expect(serialiseNote(base, 'Body')).toMatch(/---\n\nBody\n$/);
  });

  it('ends at the closing delimiter when there is no body', () => {
    expect(serialiseNote(base, '')).toMatch(/\n---\n$/);
  });

  it('reads back a file that has no blank line, without adding one on parse', () => {
    const tight = '---\ntitle: A Note\n---\nStraight after.\n';

    expect(parseNote(tight, 'x').body).toBe('Straight after.');
  });
});
