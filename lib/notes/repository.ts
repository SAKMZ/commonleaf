import 'server-only';

import { getConfig } from '../config';
import { getStorage } from '../storage';
import type { Change, Revision } from '../storage/types';
import type { ImportSummary } from '../vault/types';
import { dailySlug, dailyTemplate, dailyTitle } from './daily';
import { nowTimestamp, parseDate, toIsoDate } from './dates';
import { parseNote, serialiseNote, type Frontmatter } from './frontmatter';
import { countWords, readingMinutes } from './markdown-text';
import type { Note } from './note';
import {
  IMAGE_FOLDER,
  joinPath,
  normaliseSlug,
  pathFromSlug,
  slugifyPath,
  titleFromSlug,
} from './paths';
import { invalidateNotes } from './store';

/**
 * Everything that writes to the notebook.
 *
 * Each function is one user-visible action, and each produces exactly one
 * commit with a message a person would recognise in `git log`. Keeping them
 * here — rather than in route handlers — means the editor, the command
 * palette and a future CLI all go through the same rules about timestamps,
 * reading time and canonical serialisation.
 */

export interface SaveResult {
  readonly slug: string;
  readonly path: string;
  /** Blob SHA after the write, for the editor's next conflict check. */
  readonly sha: string;
  readonly commit: string | null;
}

export class NoteNotFoundError extends Error {
  constructor(readonly slug: string) {
    super(`No note at "${slug}".`);
    this.name = 'NoteNotFoundError';
  }
}

export class NoteExistsError extends Error {
  constructor(readonly slug: string) {
    super(`A note already exists at "${slug}".`);
    this.name = 'NoteExistsError';
  }
}

function commitMessage(action: string, title: string): string {
  return `${action} ${title}`;
}

/**
 * Fills in the fields the application maintains.
 *
 * `updated` and `reading_time` are derived, never edited by hand — if a reader
 * types something else into the frontmatter it is overwritten on the next save,
 * which is the honest behaviour for a computed field.
 */
function withDerivedFields(frontmatter: Frontmatter, body: string): Frontmatter {
  const minutes = readingMinutes(countWords(body));

  return {
    ...frontmatter,
    date: frontmatter.date || toIsoDate(new Date()),
    updated: nowTimestamp(),
    // `null` is omitted when serialised, so an empty note carries no estimate
    // at all rather than an estimate of nothing.
    reading_time: minutes === 0 ? null : minutes,
  };
}

async function applyChanges(message: string, changes: readonly Change[]) {
  const result = await getStorage().commit(message, changes);
  invalidateNotes();
  return result;
}

/** Reads one note straight from storage, bypassing the index. */
export async function readRaw(
  slug: string,
): Promise<{ frontmatter: Frontmatter; body: string; sha: string; path: string } | null> {
  const safe = normaliseSlug(slug);
  if (!safe) return null;

  const { contentDirectory } = getConfig();
  const path = pathFromSlug(safe, contentDirectory);
  const file = await getStorage().read(path);
  if (!file) return null;

  const { frontmatter, body } = parseNote(file.content, titleFromSlug(safe));
  return { frontmatter, body, sha: file.sha, path };
}

/**
 * Past versions of a note, newest first.
 *
 * Version history is the one feature that exists only because the database is
 * Git. Nothing had to be built to record it: every save is already a commit
 * with a message, and this reads them back.
 */
export async function noteHistory(slug: string, limit = 40): Promise<Revision[]> {
  const safe = normaliseSlug(slug);
  if (!safe) return [];

  const { contentDirectory } = getConfig();
  return getStorage().history(pathFromSlug(safe, contentDirectory), limit);
}

/** A note as it stood at one revision, or `null` if it did not exist then. */
export async function noteAtRevision(
  slug: string,
  revision: string,
): Promise<{ frontmatter: Frontmatter; body: string } | null> {
  const safe = normaliseSlug(slug);
  if (!safe) return null;

  const { contentDirectory } = getConfig();
  const raw = await getStorage().readAtRevision(pathFromSlug(safe, contentDirectory), revision);

  return raw === null ? null : parseNote(raw, titleFromSlug(safe));
}

export interface SaveNoteInput {
  slug: string;
  frontmatter: Frontmatter;
  body: string;
  /**
   * The blob SHA the editor loaded. Passing it is what makes the save refuse
   * to overwrite a change made elsewhere; `null` asserts the note is new.
   */
  expectedSha?: string | null;
}

export async function saveNote(input: SaveNoteInput): Promise<SaveResult> {
  const safe = normaliseSlug(input.slug);
  if (!safe) throw new NoteNotFoundError(input.slug);

  const { contentDirectory } = getConfig();
  const path = pathFromSlug(safe, contentDirectory);
  const frontmatter = withDerivedFields(input.frontmatter, input.body);
  const content = serialiseNote(frontmatter, input.body);

  const result = await applyChanges(commitMessage('Update', frontmatter.title), [
    { kind: 'write', path, content, expectedSha: input.expectedSha },
  ]);

  return { slug: safe, path, sha: result.blobs[path], commit: result.sha };
}

export interface CreateNoteInput {
  /** A title, a folder path, or both: `books/Atomic Habits`. */
  title: string;
  /** Overrides the slug derived from the title. */
  slug?: string;
  body?: string;
  folder?: string;
  tags?: string[];
  /**
   * The date the note is *about*, when that differs from the day it was
   * created. A daily note written in advance belongs to its own day.
   */
  date?: string;
}

export async function createNote(input: CreateNoteInput): Promise<SaveResult> {
  const derived = input.slug ?? slugifyPath(joinPath(input.folder ?? '', input.title));
  const safe = normaliseSlug(derived);
  if (!safe) throw new NoteNotFoundError(derived);

  const { contentDirectory } = getConfig();
  const path = pathFromSlug(safe, contentDirectory);
  const body = input.body ?? '';

  const frontmatter = withDerivedFields(
    {
      title: input.title.split('/').pop()!.trim() || titleFromSlug(safe),
      date: input.date ?? toIsoDate(new Date()),
      updated: '',
      tags: input.tags ?? [],
      favorite: false,
      source: null,
      author: null,
      aliases: [],
      reading_time: null,
    },
    body,
  );

  const result = await applyChanges(commitMessage('Create', frontmatter.title), [
    // `expectedSha: null` asserts the file does not exist, so two people
    // creating the same note at once produces a conflict rather than a
    // silent overwrite.
    { kind: 'write', path, content: serialiseNote(frontmatter, body), expectedSha: null },
  ]);

  return { slug: safe, path, sha: result.blobs[path], commit: result.sha };
}

export async function deleteNote(slug: string, title?: string): Promise<void> {
  const safe = normaliseSlug(slug);
  if (!safe) throw new NoteNotFoundError(slug);

  const { contentDirectory } = getConfig();
  await applyChanges(commitMessage('Delete', title ?? titleFromSlug(safe)), [
    { kind: 'delete', path: pathFromSlug(safe, contentDirectory) },
  ]);
}

/**
 * Moves or renames a note.
 *
 * The file moves and the title in the frontmatter is left alone: renaming a
 * file should not silently rewrite what the note calls itself.
 */
export async function moveNote(from: string, to: string): Promise<SaveResult> {
  const source = normaliseSlug(from);
  const destination = normaliseSlug(slugifyPath(to));
  if (!source) throw new NoteNotFoundError(from);
  if (!destination) throw new NoteNotFoundError(to);

  const { contentDirectory } = getConfig();
  const fromPath = pathFromSlug(source, contentDirectory);
  const toPath = pathFromSlug(destination, contentDirectory);

  if (fromPath === toPath) {
    const existing = await readRaw(source);
    if (!existing) throw new NoteNotFoundError(from);
    return { slug: source, path: fromPath, sha: existing.sha, commit: null };
  }

  if (await getStorage().read(toPath)) throw new NoteExistsError(destination);

  const result = await applyChanges(`Move ${source} to ${destination}`, [
    { kind: 'move', from: fromPath, to: toPath },
  ]);

  return { slug: destination, path: toPath, sha: result.blobs[toPath], commit: result.sha };
}

/**
 * Returns the note a wiki link points at, creating it if it does not exist.
 *
 * This is what makes `[[Stoicism]]` a promise rather than a dead end: follow
 * the link and the note is waiting, titled and dated, ready to be written.
 */
export async function ensureNote(target: string): Promise<SaveResult> {
  const slug = slugifyPath(target);
  const existing = await readRaw(slug);

  if (existing) {
    const { contentDirectory } = getConfig();
    return {
      slug,
      path: pathFromSlug(slug, contentDirectory),
      sha: existing.sha,
      commit: null,
    };
  }

  return createNote({ title: target, slug });
}

/**
 * Returns the daily note for a date, creating it if it does not exist.
 *
 * The date is supplied by the caller because only the browser knows what
 * "today" means for the reader; see `daily.ts`.
 */
export async function ensureDailyNote(isoDate: string): Promise<SaveResult> {
  const date = parseDate(isoDate);
  if (!date) throw new NoteNotFoundError(isoDate);

  const slug = dailySlug(date);
  const existing = await readRaw(slug);

  if (existing) {
    const { contentDirectory } = getConfig();
    return {
      slug,
      path: pathFromSlug(slug, contentDirectory),
      sha: existing.sha,
      commit: null,
    };
  }

  return createNote({
    title: dailyTitle(date),
    slug,
    body: dailyTemplate(),
    // A daily note belongs to its own day, not to the day it was opened.
    date: toIsoDate(date),
  });
}

/**
 * Writes an image and returns the Markdown path to reference it by.
 *
 * Images live in one folder rather than beside the note that uses them: notes
 * get moved and renamed, and an attachment that has to follow them around is a
 * source of broken links.
 */
export async function saveImage(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ path: string; markdownPath: string }> {
  const { contentDirectory } = getConfig();
  const safeName = uniqueImageName(fileName);
  const relative = joinPath(IMAGE_FOLDER, safeName);
  const path = joinPath(contentDirectory, relative);

  await applyChanges(`Add image ${safeName}`, [{ kind: 'write-binary', path, bytes }]);

  return { path, markdownPath: `/${relative}` };
}

/**
 * A collision-free file name that still says something about the image.
 *
 * Date first so the images folder sorts chronologically in any file browser.
 */
function uniqueImageName(original: string): string {
  const match = /^(.*?)(\.[a-z0-9]+)?$/i.exec(original.trim());
  const stem = slugifyPath(match?.[1] ?? 'image').replace(/\//g, '-');
  const extension = (match?.[2] ?? '.png').toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  return `${stamp}-${stem}${extension}`;
}

/**
 * Brings a folder of Markdown in, as one commit.
 *
 * The bytes are written exactly as they arrived. It would be easy to re-serialise
 * every note into this application's canonical form on the way in — and it would
 * be wrong: importing somebody's vault is not an invitation to reformat it. A
 * file only changes when its author next saves it.
 */
export async function importNotes(
  files: readonly { path: string; text: string }[],
  { overwrite = false } = {},
): Promise<ImportSummary> {
  const { contentDirectory } = getConfig();
  const storage = getStorage();

  const existing = new Set((await storage.readTree(contentDirectory)).map((file) => file.path));

  const changes: Change[] = [];
  const rejected: string[] = [];
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = normaliseSlug(file.path.replace(/\.(md|markdown)$/i, ''));
    if (!slug) {
      rejected.push(file.path);
      continue;
    }

    const path = pathFromSlug(slug, contentDirectory);

    if (existing.has(path)) {
      if (!overwrite) {
        skipped += 1;
        continue;
      }
      replaced += 1;
    } else {
      added += 1;
    }

    changes.push({ kind: 'write', path, content: file.text });
  }

  if (changes.length > 0) {
    await applyChanges(
      `Import ${changes.length} note${changes.length === 1 ? '' : 's'}`,
      changes,
    );
  }

  return { added, replaced, skipped, rejected };
}

/** Convenience for callers holding a {@link Note} rather than raw fields. */
export function toSaveInput(note: Note, body = note.body): SaveNoteInput {
  return {
    slug: note.slug,
    frontmatter: note.frontmatter,
    body,
    expectedSha: note.sha,
  };
}
