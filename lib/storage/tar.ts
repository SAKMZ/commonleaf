/**
 * A minimal reader for the tar streams GitHub serves from its tarball
 * endpoint.
 *
 * Downloading one archive is dramatically cheaper than fetching a few hundred
 * blobs individually, both in wall-clock time and in API quota, and the format
 * is small enough to read directly. Only the pieces `git archive` actually
 * emits are handled: regular files, directories, GNU long names and pax
 * extended headers.
 */

const BLOCK_SIZE = 512;

export interface TarEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

function readString(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end === -1 ? slice : slice.subarray(0, end));
}

/** Tar stores numbers as NUL/space-terminated octal. */
function readOctal(block: Uint8Array, offset: number, length: number): number {
  const text = readString(block, offset, length).trim();
  if (text === '') return 0;
  const value = Number.parseInt(text, 8);
  return Number.isFinite(value) ? value : 0;
}

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

/** Extracts `path=` from a pax extended header payload. */
function paxPath(payload: Uint8Array): string | null {
  const text = new TextDecoder().decode(payload);
  // Records look like: "<length> <key>=<value>\n"
  for (const record of text.split('\n')) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match) return match[1];
  }
  return null;
}

export function readTar(archive: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingLongName: string | null = null;

  while (offset + BLOCK_SIZE <= archive.byteLength) {
    const header = archive.subarray(offset, offset + BLOCK_SIZE);
    offset += BLOCK_SIZE;

    // Two consecutive zero blocks terminate the archive; one is enough for us.
    if (isZeroBlock(header)) break;

    const size = readOctal(header, 124, 12);
    const typeFlag = readString(header, 156, 1);
    const payload = archive.subarray(offset, offset + size);
    offset += Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

    if (typeFlag === 'L') {
      // GNU long name: the next header's file name lives in this payload.
      pendingLongName = new TextDecoder().decode(payload).replace(/\0+$/, '');
      continue;
    }

    if (typeFlag === 'x' || typeFlag === 'g') {
      pendingLongName = paxPath(payload) ?? pendingLongName;
      continue;
    }

    const name =
      pendingLongName ??
      (() => {
        const prefix = readString(header, 345, 155);
        const base = readString(header, 0, 100);
        return prefix ? `${prefix}/${base}` : base;
      })();
    pendingLongName = null;

    // '0' and '\0' are regular files; everything else (directories, links) is
    // not something the note index cares about.
    if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '') {
      entries.push({ path: name, bytes: payload });
    }
  }

  return entries;
}

/**
 * Removes the single top-level directory (`owner-repo-sha/`) that GitHub wraps
 * around archive contents.
 */
export function stripRootDirectory(entries: readonly TarEntry[]): TarEntry[] {
  return entries.flatMap((entry) => {
    const index = entry.path.indexOf('/');
    if (index === -1) return [];
    return [{ path: entry.path.slice(index + 1), bytes: entry.bytes }];
  });
}
