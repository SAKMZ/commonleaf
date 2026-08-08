import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { normaliseArchivePath, readVaultArchive } from '@/lib/vault/archive';

/**
 * An uploaded archive is untrusted input from a file somebody was handed, so
 * these are mostly about what must *not* get through.
 */

describe('normaliseArchivePath', () => {
  it('keeps an ordinary path', () => {
    expect(normaliseArchivePath('books/atomic-habits.md')).toBe('books/atomic-habits.md');
  });

  it('accepts Windows separators', () => {
    expect(normaliseArchivePath('books\\atomic-habits.md')).toBe('books/atomic-habits.md');
  });

  it('refuses to climb out of the vault', () => {
    expect(normaliseArchivePath('../secrets.md')).toBeNull();
    expect(normaliseArchivePath('books/../../etc/passwd')).toBeNull();
    expect(normaliseArchivePath('a/b/../../../c.md')).toBeNull();
  });

  it('strips a leading slash rather than treating it as absolute', () => {
    expect(normaliseArchivePath('/books/note.md')).toBe('books/note.md');
  });

  it('refuses a Windows drive letter', () => {
    expect(normaliseArchivePath('C:/notes/note.md')).toBeNull();
  });

  it('skips tool metadata', () => {
    expect(normaliseArchivePath('.obsidian/workspace.json')).toBeNull();
    expect(normaliseArchivePath('__MACOSX/._note.md')).toBeNull();
    expect(normaliseArchivePath('.git/config')).toBeNull();
  });

  it('has no answer for an empty path', () => {
    expect(normaliseArchivePath('')).toBeNull();
    expect(normaliseArchivePath('./')).toBeNull();
  });
});

async function archiveOf(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('readVaultArchive', () => {
  it('reads the Markdown out of an archive', async () => {
    const files = await readVaultArchive(
      await archiveOf({
        'welcome.md': '# Welcome',
        'books/atomic-habits.markdown': 'Notes.',
      }),
    );

    expect(files.map((file) => file.path).sort()).toEqual([
      'books/atomic-habits.markdown',
      'welcome.md',
    ]);
    expect(files.find((file) => file.path === 'welcome.md')?.text).toBe('# Welcome');
  });

  it('ignores files that are not notes', async () => {
    const files = await readVaultArchive(
      await archiveOf({
        'note.md': 'Keep me.',
        'workspace.json': '{}',
        'script.sh': 'rm -rf /',
        '.obsidian/app.json': '{}',
      }),
    );

    expect(files.map((file) => file.path)).toEqual(['note.md']);
  });

  it('never yields a path that climbs out of the vault', async () => {
    /*
     * There are two defences here and this asserts the outcome rather than
     * which one acted: JSZip normalises `../` away in both directions, and
     * `normaliseArchivePath` — tested directly above — rejects anything that
     * still climbs. The entry is renamed after the fact because JSZip will not
     * write one like this in the first place.
     */
    const zip = new JSZip();
    zip.file('escape.md', 'nope');

    const entry = zip.files['escape.md'];
    delete zip.files['escape.md'];
    entry.name = '../escape.md';
    zip.files['../escape.md'] = entry;

    const files = await readVaultArchive(await zip.generateAsync({ type: 'uint8array' }));

    expect(files.every((file) => !file.path.includes('..'))).toBe(true);
  });

  it('returns nothing for an archive with no notes in it', async () => {
    expect(await readVaultArchive(await archiveOf({ 'photo.png': 'x' }))).toEqual([]);
  });
});
