import matter from 'gray-matter';
import { CORE_SCHEMA, dump, load } from 'js-yaml';

/**
 * YAML read and written with the core schema rather than YAML 1.1.
 *
 * The default schema turns `date: 2026-01-04` into a JavaScript `Date`, which
 * then has to be turned back into text — and comes back as
 * `2026-01-04T00:00:00.000Z`, silently rewriting the reader's file with a
 * timezone they never asked for. The core schema leaves scalars as strings, so
 * what is in the file is what we read and what we write.
 */
const yamlEngine = {
  parse: (input: string): object => (load(input, { schema: CORE_SCHEMA }) as object) ?? {},
  stringify: (data: object): string =>
    dump(data, {
      schema: CORE_SCHEMA,
      // Wrapped YAML is harder to read in a diff.
      lineWidth: -1,
      noRefs: true,
    }),
};

const MATTER_OPTIONS = { engines: { yaml: yamlEngine } };

/**
 * The YAML block at the top of every note.
 *
 * Parsing is deliberately forgiving — these files are meant to be edited by
 * hand, in any editor, possibly years from now. A malformed `tags:` line
 * should never stop a note from opening. Writing, by contrast, is strict and
 * canonical so that files stay tidy and diffs stay small.
 */
export interface Frontmatter {
  title: string;
  /** ISO 8601 date the note was created. */
  date: string;
  /** ISO 8601 timestamp of the last edit made through the app. */
  updated: string;
  tags: string[];
  favorite: boolean;
  source: string | null;
  author: string | null;
  aliases: string[];
  /** Estimated minutes to read, recalculated on save. */
  reading_time: number | null;
}

export interface ParsedNote {
  frontmatter: Frontmatter;
  body: string;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return null;
}

/** Accepts `tags: a, b`, `tags: [a, b]`, and the YAML list form. */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter((item): item is string => item !== null);
  }
  const single = asString(value);
  if (!single) return [];
  return single
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = asString(value)?.toLowerCase();
  return text === 'true' || text === 'yes' || text === '1';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(asString(value) ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

/** Leading `#` characters are stored by some tools; the index does not want them. */
export function normaliseTag(tag: string): string {
  return tag
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

export function parseNote(raw: string, fallbackTitle: string): ParsedNote {
  let data: Record<string, unknown> = {};
  let body: string;

  try {
    const parsed = matter(raw, MATTER_OPTIONS);
    data = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch {
    // Unparseable YAML: treat the file as body-only rather than losing it.
    body = raw;
  }

  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();

  return {
    frontmatter: {
      title: asString(data.title) ?? heading ?? fallbackTitle,
      date: asString(data.date) ?? '',
      updated: asString(data.updated) ?? asString(data.date) ?? '',
      tags: asStringList(data.tags).map(normaliseTag).filter(Boolean),
      favorite: asBoolean(data.favorite),
      source: asString(data.source),
      author: asString(data.author),
      aliases: asStringList(data.aliases),
      reading_time: asNumber(data.reading_time),
    },
    // Trimmed at both ends so that parsing and serialising are exact inverses
    // and re-saving an untouched note produces no diff.
    body: body.replace(/^\n+/, '').replace(/\s+$/, ''),
  };
}

/**
 * Serialises a note back to Markdown.
 *
 * Keys are written in a fixed order and empty optional fields are omitted, so
 * that saving a note twice produces byte-identical output and Git history
 * records real edits only.
 */
export function serialiseNote(frontmatter: Frontmatter, body: string): string {
  const data: Record<string, unknown> = {
    title: frontmatter.title,
    date: frontmatter.date,
    updated: frontmatter.updated,
    tags: frontmatter.tags,
    favorite: frontmatter.favorite,
  };

  if (frontmatter.source) data.source = frontmatter.source;
  if (frontmatter.author) data.author = frontmatter.author;
  if (frontmatter.aliases.length > 0) data.aliases = frontmatter.aliases;
  if (frontmatter.reading_time !== null) data.reading_time = frontmatter.reading_time;

  /*
   * The block is written on its own and the body appended, rather than letting
   * gray-matter join them: it puts the first line of prose directly against the
   * closing `---`, where every hand-written note — and every other tool — leaves
   * a blank line. Saving a note should not quietly restyle the file.
   */
  const block = matter
    .stringify('', data, MATTER_OPTIONS)
    .replace(/\r\n/g, '\n')
    .replace(/\n+$/, '\n');

  const trimmed = body.replace(/\s+$/, '').replace(/\r\n/g, '\n');

  return trimmed === '' ? block : `${block}\n${trimmed}\n`;
}
