import { describe, expect, it } from 'vitest';

import { routes, slugFromPathname } from '@/lib/notes/links';

describe('routes', () => {
  it('encodes each segment but keeps the separators', () => {
    expect(routes.note('books/atomic habits')).toBe('/notes/books/atomic%20habits');
    expect(routes.tag('books/philosophy')).toBe('/tags/books/philosophy');
  });

  it('keeps editing and history off the note path, since it is a catch-all', () => {
    expect(routes.edit('a/b')).toBe('/edit/a/b');
    expect(routes.history('a/b')).toBe('/history/a/b');
  });

  it('passes the date to the daily route as a query parameter', () => {
    expect(routes.daily('2026-08-07')).toBe('/daily?date=2026-08-07');
  });
});

describe('slugFromPathname', () => {
  it('reads the note out of every URL that is about one', () => {
    expect(slugFromPathname('/notes/philosophy/stoicism')).toBe('philosophy/stoicism');
    expect(slugFromPathname('/edit/philosophy/stoicism')).toBe('philosophy/stoicism');
    expect(slugFromPathname('/history/philosophy/stoicism')).toBe('philosophy/stoicism');
  });

  it('decodes what the route encoded', () => {
    expect(slugFromPathname(routes.note('books/atomic habits'))).toBe('books/atomic habits');
  });

  it('has no answer for pages that are not about a note', () => {
    expect(slugFromPathname('/')).toBeNull();
    expect(slugFromPathname('/tags/books')).toBeNull();
    expect(slugFromPathname('/settings')).toBeNull();
    expect(slugFromPathname('/notes/')).toBeNull();
  });
});
