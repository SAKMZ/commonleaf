import { describe, expect, it } from 'vitest';

import { readTar, stripRootDirectory } from '@/lib/storage/tar';

import { buildTar } from '../helpers/tar';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('readTar', () => {
  it('reads regular files with their contents', () => {
    const archive = buildTar([
      { path: 'content/one.md', content: '# One\n' },
      { path: 'content/two.md', content: '# Two\n' },
    ]);

    const entries = readTar(archive);

    expect(entries.map((entry) => entry.path)).toEqual(['content/one.md', 'content/two.md']);
    expect(decode(entries[0].bytes)).toBe('# One\n');
  });

  it('skips directories', () => {
    const archive = buildTar([
      { path: 'content/', content: '', typeFlag: '5' },
      { path: 'content/note.md', content: 'body' },
    ]);

    expect(readTar(archive).map((entry) => entry.path)).toEqual(['content/note.md']);
  });

  it('handles payloads that do not fill a whole block', () => {
    // 600 bytes spans two blocks with 424 bytes of padding to ignore.
    const content = 'x'.repeat(600);
    const entries = readTar(buildTar([{ path: 'a.md', content }]));

    expect(decode(entries[0].bytes)).toBe(content);
  });

  it('takes the file name from a preceding pax header', () => {
    const longPath = `content/${'deep/'.repeat(30)}note.md`;
    // A pax record is "<length> <key>=<value>\n"; the reader only needs the key.
    const record = `path=${longPath}\n`;
    const paxPayload = `${record.length + 4} ${record}`;

    const entries = readTar(
      buildTar([
        { path: 'pax_global_header', content: paxPayload, typeFlag: 'x' },
        { path: 'truncated-name.md', content: 'body' },
      ]),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe(longPath);
  });

  it('takes the file name from a GNU long name entry', () => {
    const longPath = `content/${'section/'.repeat(20)}note.md`;

    const entries = readTar(
      buildTar([
        { path: '././@LongLink', content: longPath, typeFlag: 'L' },
        { path: 'truncated.md', content: 'body' },
      ]),
    );

    expect(entries[0].path).toBe(longPath);
  });

  it('stops at the end-of-archive marker', () => {
    const archive = buildTar([{ path: 'a.md', content: 'a' }]);
    // Trailing rubbish after the marker must not be read as another entry.
    const withTrailer = new Uint8Array(archive.byteLength + 512);
    withTrailer.set(archive);
    withTrailer.fill(0x41, archive.byteLength);

    expect(readTar(withTrailer)).toHaveLength(1);
  });
});

describe('stripRootDirectory', () => {
  it('removes the archive wrapper GitHub adds', () => {
    const entries = stripRootDirectory([
      { path: 'owner-repo-abc123/content/note.md', bytes: new Uint8Array() },
      { path: 'owner-repo-abc123/README.md', bytes: new Uint8Array() },
    ]);

    expect(entries.map((entry) => entry.path)).toEqual(['content/note.md', 'README.md']);
  });

  it('drops entries that have no directory to strip', () => {
    expect(stripRootDirectory([{ path: 'loose-file', bytes: new Uint8Array() }])).toEqual([]);
  });
});
