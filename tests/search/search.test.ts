import { describe, expect, it } from 'vitest';

import { NoteCollection } from '@/lib/notes/collection';
import { buildNote } from '@/lib/notes/note';
import { buildSearchDocuments } from '@/lib/search/documents';
import { createSearcher } from '@/lib/search/searcher';

function note(path: string, frontmatter: string, body: string) {
  const content = `---\n${frontmatter}\n---\n\n${body}\n`;
  return buildNote({ path, sha: path, size: content.length, content }, 'content')!;
}

const collection = new NoteCollection([
  note(
    'content/philosophy/stoicism.md',
    'title: Stoicism\ndate: 2026-06-02\nupdated: 2026-06-09T10:00:00.000Z\ntags: [philosophy]',
    'The dichotomy of control.',
  ),
  note(
    'content/books/atomic-habits.md',
    'title: Atomic Habits\ndate: 2026-05-01\nupdated: 2026-05-02T10:00:00.000Z\ntags: [books]',
    'Behaviour follows identity.',
  ),
  note(
    'content/programming/plain-text.md',
    'title: Plain text outlives software\ndate: 2026-04-01\nupdated: 2026-04-02T10:00:00.000Z\ntags: [programming]',
    'Every note-taking application I have lost data to had a database.',
  ),
]);

describe('buildSearchDocuments', () => {
  it('carries only what search needs', () => {
    const [first] = buildSearchDocuments(collection);

    expect(Object.keys(first).sort()).toEqual([
      'excerpt',
      'folder',
      'slug',
      'tags',
      'title',
      'updated',
    ]);
  });

  it('carries an excerpt rather than the body, so the index stays small', () => {
    const long = 'A sentence that goes on. '.repeat(80);
    const one = new NoteCollection([
      note(
        'content/long.md',
        'title: Long\ndate: 2026-01-01\nupdated: 2026-01-01T00:00:00.000Z',
        `${long}\n\nThe ending nobody will see in a result.`,
      ),
    ]);

    const [document_] = buildSearchDocuments(one);

    expect(document_.excerpt.length).toBeLessThan(200);
    expect(JSON.stringify(document_)).not.toContain('nobody will see');
  });

  it('keeps the collection order, which is newest first', () => {
    expect(buildSearchDocuments(collection).map((document) => document.title)).toEqual([
      'Stoicism',
      'Atomic Habits',
      'Plain text outlives software',
    ]);
  });
});

describe('createSearcher', () => {
  it('finds a note by an approximate title', async () => {
    const searcher = await createSearcher(buildSearchDocuments(collection));

    expect(searcher.search('stoic', 5)[0].slug).toBe('philosophy/stoicism');
    expect(searcher.search('atomik habits', 5)[0].slug).toBe('books/atomic-habits');
  });

  it('finds a note by its tag', async () => {
    const searcher = await createSearcher(buildSearchDocuments(collection));

    expect(searcher.search('programming', 5)[0].slug).toBe('programming/plain-text');
  });

  it('shows the notebook rather than nothing for an empty query', async () => {
    const searcher = await createSearcher(buildSearchDocuments(collection));

    expect(searcher.search('   ', 2)).toHaveLength(2);
  });

  it('respects the limit', async () => {
    const searcher = await createSearcher(buildSearchDocuments(collection));

    expect(searcher.search('', 1)).toHaveLength(1);
  });

  it('returns nothing for a query that matches nothing', async () => {
    const searcher = await createSearcher(buildSearchDocuments(collection));

    expect(searcher.search('qwertyuiop', 5)).toEqual([]);
  });
});
