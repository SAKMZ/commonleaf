import { describe, expect, it } from 'vitest';

import { NoteCollection } from '@/lib/notes/collection';
import { buildNote, type Note } from '@/lib/notes/note';
import { gitBlobSha } from '@/lib/storage/git-hash';

/** Builds a note the way the store does, so the tests exercise the real path. */
function note(slug: string, content: string): Note {
  const path = `content/${slug}.md`;
  return buildNote(
    { path, sha: gitBlobSha(content), size: content.length, content },
    'content',
  )!;
}

function collect(...notes: Note[]): NoteCollection {
  return new NoteCollection(notes);
}

describe('NoteCollection', () => {
  describe('link resolution', () => {
    const stoicism = note(
      'philosophy/stoicism',
      '---\ntitle: Stoicism\naliases: [The Porch]\n---\n\nOn the philosophy.',
    );

    it('resolves by slug', () => {
      expect(collect(stoicism).resolve('philosophy/stoicism')?.slug).toBe(
        'philosophy/stoicism',
      );
    });

    it('resolves by title, ignoring case', () => {
      expect(collect(stoicism).resolve('stoicism')?.slug).toBe('philosophy/stoicism');
      expect(collect(stoicism).resolve('STOICISM')?.slug).toBe('philosophy/stoicism');
    });

    it('resolves by alias', () => {
      expect(collect(stoicism).resolve('the porch')?.slug).toBe('philosophy/stoicism');
    });

    it('treats spaces and hyphens as the same', () => {
      const habits = note('books/atomic-habits', '---\ntitle: Atomic Habits\n---\n');
      const notes = collect(habits);

      expect(notes.resolve('Atomic Habits')?.slug).toBe('books/atomic-habits');
      expect(notes.resolve('atomic-habits')?.slug).toBe('books/atomic-habits');
    });

    it('returns nothing for a target that does not exist', () => {
      expect(collect(stoicism).resolve('Nothing Here')).toBeUndefined();
    });

    it('prefers a real note over another note that merely lists it as an alias', () => {
      const real = note('ideas/focus', '---\ntitle: Focus\n---\n');
      const impostor = note('ideas/other', '---\ntitle: Other\naliases: [Focus]\n---\n');

      // Both orderings must give the same answer; otherwise resolution would
      // depend on which note happened to be edited last.
      expect(collect(real, impostor).resolve('Focus')?.slug).toBe('ideas/focus');
      expect(collect(impostor, real).resolve('Focus')?.slug).toBe('ideas/focus');
    });
  });

  describe('backlinks', () => {
    it('records who links to a note, with context', () => {
      const target = note('philosophy/stoicism', '---\ntitle: Stoicism\n---\n');
      const source = note(
        'daily/2026-08-07',
        '---\ntitle: Thursday\n---\n\nRead more about [[Stoicism]] this evening.',
      );

      const backlinks = collect(target, source).backlinks('philosophy/stoicism');

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].slug).toBe('daily/2026-08-07');
      // Quoted as prose, not as markup.
      expect(backlinks[0].context).toBe('Read more about Stoicism this evening.');
    });

    it('counts two links from one note as a single mention', () => {
      const target = note('a', '---\ntitle: A\n---\n');
      const source = note('b', '---\ntitle: B\n---\n\n[[A]] and again [[A]].');

      expect(collect(target, source).mentionCount('a')).toBe(1);
    });

    it('ignores a note linking to itself', () => {
      const self = note('a', '---\ntitle: A\n---\n\nSee [[A]].');

      expect(collect(self).backlinks('a')).toEqual([]);
    });

    it('ignores links inside code', () => {
      const target = note('a', '---\ntitle: A\n---\n');
      const source = note('b', '---\ntitle: B\n---\n\nWrite `[[A]]` to link.\n');

      expect(collect(target, source).mentionCount('a')).toBe(0);
    });

    it('collects targets that have no note yet', () => {
      const source = note('b', '---\ntitle: B\n---\n\nSee [[Not Written]].');

      expect(collect(source).unresolvedTargets).toEqual(['Not Written']);
    });
  });

  describe('tags', () => {
    const a = note('a', '---\ntitle: A\ntags: [books/philosophy]\n---\n');
    const b = note('b', '---\ntitle: B\ntags: [books/fiction]\n---\n');
    const c = note('c', '---\ntitle: C\n---\n\nTagged inline with #books/philosophy here.');

    it('nests tags and counts ancestors', () => {
      const { tags } = collect(a, b, c);

      expect(tags).toHaveLength(1);
      expect(tags[0].path).toBe('books');
      expect(tags[0].totalCount).toBe(3);
      expect(tags[0].children.map((child) => child.path)).toEqual([
        'books/fiction',
        'books/philosophy',
      ]);
    });

    it('finds notes by a parent tag', () => {
      expect(collect(a, b, c).tagged('books')).toHaveLength(3);
      expect(collect(a, b, c).tagged('books/philosophy')).toHaveLength(2);
    });

    it('merges frontmatter and inline tags without duplicating', () => {
      const both = note('d', '---\ntitle: D\ntags: [ideas]\n---\n\nAlso #ideas inline.');

      expect(both.tags).toEqual(['ideas']);
    });
  });

  describe('views', () => {
    it('sorts newest first', () => {
      const older = note('older', '---\ntitle: Older\nupdated: 2026-01-01T00:00:00Z\n---\n');
      const newer = note('newer', '---\ntitle: Newer\nupdated: 2026-06-01T00:00:00Z\n---\n');

      expect(collect(older, newer).notes.map((item) => item.slug)).toEqual(['newer', 'older']);
    });

    it('lists favorites', () => {
      const kept = note('kept', '---\ntitle: Kept\nfavorite: true\n---\n');
      const other = note('other', '---\ntitle: Other\n---\n');

      expect(collect(kept, other).favorites.map((item) => item.slug)).toEqual(['kept']);
    });

    it('builds a folder tree that counts nested notes', () => {
      const { folders } = collect(
        note('books/one', '---\ntitle: One\n---\n'),
        note('books/philosophy/two', '---\ntitle: Two\n---\n'),
        note('top', '---\ntitle: Top\n---\n'),
      );

      expect(folders).toHaveLength(1);
      expect(folders[0]).toMatchObject({ path: 'books', count: 2 });
      expect(folders[0].children[0]).toMatchObject({ path: 'books/philosophy', count: 1 });
    });

    it('returns notes in a folder and its subfolders', () => {
      const notes = collect(
        note('books/one', '---\ntitle: One\n---\n'),
        note('books/philosophy/two', '---\ntitle: Two\n---\n'),
        note('bookshelf/three', '---\ntitle: Three\n---\n'),
      );

      // `bookshelf` must not be swept in by a prefix match on `books`.
      expect(
        notes
          .inFolder('books')
          .map((item) => item.slug)
          .sort(),
      ).toEqual(['books/one', 'books/philosophy/two']);
    });

    it('picks a random note deterministically when given a source', () => {
      const notes = collect(note('a', '# A'), note('b', '# B'), note('c', '# C'));

      expect(notes.random(() => 0)?.slug).toBe(notes.notes[0].slug);
      expect(notes.random(() => 0.999)?.slug).toBe(notes.notes[2].slug);
    });

    it('has no random note when empty', () => {
      expect(collect().random()).toBeUndefined();
    });
  });

  describe('neighbours', () => {
    const shelf = () =>
      collect(
        note('books/b-second', '---\ntitle: Second\n---\n'),
        note('books/c-third', '---\ntitle: Third\n---\n'),
        note('books/a-first', '---\ntitle: First\n---\n'),
      );

    it('reads a folder in file order, not in the order it was written', () => {
      const { previous, next } = shelf().neighbours('books/b-second');

      expect(previous?.slug).toBe('books/a-first');
      expect(next?.slug).toBe('books/c-third');
    });

    it('stops at the ends', () => {
      expect(shelf().neighbours('books/a-first').previous).toBeUndefined();
      expect(shelf().neighbours('books/c-third').next).toBeUndefined();
    });

    it('treats a subfolder as its own sequence', () => {
      // `books/deep/x` is not the page after `books/a`, because it is inside
      // something else — the way a chapter is not the next paragraph.
      const notes = collect(
        note('books/a', '---\ntitle: A\n---\n'),
        note('books/deep/x', '---\ntitle: X\n---\n'),
        note('books/z', '---\ntitle: Z\n---\n'),
      );

      expect(notes.neighbours('books/a').next?.slug).toBe('books/z');
      expect(notes.neighbours('books/deep/x')).toEqual({
        previous: undefined,
        next: undefined,
      });
    });

    it('has nothing to say about a note that does not exist', () => {
      expect(shelf().neighbours('books/nowhere')).toEqual({});
    });
  });
});
