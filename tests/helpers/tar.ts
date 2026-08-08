/**
 * Builds tar archives for the storage tests.
 *
 * Writing a tiny writer here rather than pulling in a tar library keeps the
 * test dependencies honest: the reader under test is only a few hundred bytes
 * of logic, and a fixture generator should not be larger than the thing it
 * exercises.
 */

const BLOCK = 512;

function writeString(block: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  block.set(bytes.subarray(0, length), offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  // Tar stores numbers as zero-padded octal with a trailing NUL.
  writeString(block, offset, length, value.toString(8).padStart(length - 1, '0'));
}

function header(name: string, size: number, typeFlag: string): Uint8Array {
  const block = new Uint8Array(BLOCK);
  writeString(block, 0, 100, name);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, 0);
  writeString(block, 148, 8, '        '); // checksum placeholder
  writeString(block, 156, 1, typeFlag);
  writeString(block, 257, 6, 'ustar');
  writeString(block, 263, 2, '00');

  // The checksum is the sum of every header byte with the field itself blank.
  const checksum = block.reduce((total, byte) => total + byte, 0);
  writeString(block, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  return block;
}

function pad(bytes: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil(bytes.byteLength / BLOCK) * BLOCK);
  padded.set(bytes);
  return padded;
}

export interface TarInput {
  path: string;
  content: string;
  /** '0' regular file, '5' directory, 'x' pax header, 'L' GNU long name. */
  typeFlag?: string;
}

export function buildTar(entries: readonly TarInput[]): Uint8Array {
  const blocks: Uint8Array[] = [];

  for (const entry of entries) {
    const payload = new TextEncoder().encode(entry.content);
    blocks.push(header(entry.path, payload.byteLength, entry.typeFlag ?? '0'));
    if (payload.byteLength > 0) blocks.push(pad(payload));
  }

  // Two zero blocks mark the end of an archive.
  blocks.push(new Uint8Array(BLOCK * 2));

  const total = blocks.reduce((sum, block) => sum + block.byteLength, 0);
  const archive = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    archive.set(block, offset);
    offset += block.byteLength;
  }
  return archive;
}

/** Wraps entries in the `owner-repo-sha/` prefix GitHub adds. */
export function buildRepositoryTar(root: string, entries: readonly TarInput[]): Uint8Array {
  return buildTar(entries.map((entry) => ({ ...entry, path: `${root}/${entry.path}` })));
}
