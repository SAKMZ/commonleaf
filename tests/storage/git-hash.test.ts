import { describe, expect, it } from 'vitest';

import { gitBlobSha } from '@/lib/storage/git-hash';

/**
 * These are the identifiers Git itself produces (`git hash-object`). Pinning
 * them matters: the conflict check compares a SHA computed here against one
 * reported by GitHub, so any drift would silently disable it.
 */
describe('gitBlobSha', () => {
  it('matches git hash-object for a simple file', () => {
    expect(gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('matches git hash-object for an empty file', () => {
    expect(gitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('hashes bytes and the equivalent string identically', () => {
    const text = '# Title\n\nSome prose.\n';
    expect(gitBlobSha(new TextEncoder().encode(text))).toBe(gitBlobSha(text));
  });

  it('accounts for multi-byte characters by byte length, not code points', () => {
    // "é" is two bytes; hashing by string length would produce a different id.
    expect(gitBlobSha('é')).toBe(gitBlobSha(new Uint8Array([0xc3, 0xa9])));
  });
});
