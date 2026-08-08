import 'server-only';

import JSZip from 'jszip';

import { getConfig } from '../config';
import type { NoteCollection } from '../notes/collection';
import { getStorage } from '../storage';

/**
 * Taking the whole notebook away, and bringing one back.
 *
 * This is the promise at the centre of the project made operational: the data
 * is a folder of Markdown files, and you can have it, in one click, in a format
 * every other tool on earth understands. Nothing here is a proprietary dump —
 * the ZIP contains exactly the files that are in the repository, byte for byte.
 */

/** How large an uploaded archive may be, in bytes. */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Files worth carrying: notes, and the pictures they refer to. */
const IMPORTABLE = /\.(md|markdown|png|jpe?g|gif|webp|svg|avif)$/i;
const MARKDOWN = /\.(md|markdown)$/i;

export function archiveFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `commonleaf-${stamp}.zip`;
}

/**
 * Every file under the content directory, as a ZIP.
 *
 * Paths inside the archive are relative to the content directory, so unzipping
 * it produces the vault itself rather than a nest of parent folders.
 */
export async function buildVaultArchive(): Promise<Uint8Array> {
  const { contentDirectory } = getConfig();
  const files = await getStorage().readTree(contentDirectory);

  const zip = new JSZip();
  const prefix = contentDirectory === '' ? '' : `${contentDirectory}/`;

  for (const file of files) {
    zip.file(
      file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path,
      file.content,
    );
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * The notebook as one JSON document.
 *
 * The ZIP is the real export; this exists for feeding the notes into something
 * else without a Markdown parser. It carries the parsed frontmatter alongside
 * the body, which is the part another tool would otherwise have to re-derive.
 */
export function buildVaultJson(collection: NoteCollection) {
  return {
    exportedAt: new Date().toISOString(),
    count: collection.size,
    notes: collection.notes.map((note) => ({
      slug: note.slug,
      path: note.path,
      title: note.title,
      frontmatter: note.frontmatter,
      tags: note.tags,
      body: note.body,
    })),
  };
}

export interface ImportedFile {
  /** Path relative to the content directory. */
  readonly path: string;
  readonly text: string;
}

/**
 * Reads an uploaded archive into the files worth keeping.
 *
 * An Obsidian vault, a Jekyll `_posts` folder and a ZIP produced by this
 * application all look the same once unzipped — a tree of Markdown — so there
 * is no per-tool importer, only this.
 */
export async function readVaultArchive(bytes: Uint8Array): Promise<ImportedFile[]> {
  const zip = await JSZip.loadAsync(bytes);
  const files: ImportedFile[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;

    const path = normaliseArchivePath(entry.name);
    if (path === null || !IMPORTABLE.test(path)) continue;

    // Only Markdown is imported as text. Images inside an archive are skipped
    // rather than silently corrupted by being read as UTF-8 — see below.
    if (!MARKDOWN.test(path)) continue;

    files.push({ path, text: await entry.async('string') });
  }

  return files;
}

/**
 * Cleans a path out of an archive, or rejects it.
 *
 * Archives are untrusted input, and a ZIP is perfectly capable of containing
 * `../../etc/passwd`. Anything that escapes, is absolute, or hides in a dot
 * directory is dropped rather than repaired.
 */
export function normaliseArchivePath(name: string): string | null {
  const cleaned = name.replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleaned === '') return null;

  const segments: string[] = [];

  for (const segment of cleaned.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') return null;
    // macOS resource forks, `.obsidian`, `.git` — metadata, not notes.
    if (segment.startsWith('.') || segment === '__MACOSX') return null;
    if (segment.includes(':')) return null;
    segments.push(segment);
  }

  return segments.length === 0 ? null : segments.join('/');
}
