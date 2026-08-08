import { byRecency, type Note } from './note';
import { baseNameOf } from './paths';
import { buildTagTree, tagLineage, type TagNode } from './tags';
import { contextFor, linkKey, type WikiLink } from './wikilinks';

/**
 * The whole notebook, indexed.
 *
 * This is a pure value: given the same notes it always produces the same
 * result, with no I/O and no clock. `store.ts` is responsible for reading files
 * and deciding when to rebuild; keeping the two apart is what makes the tricky
 * parts — link resolution and backlinks — straightforward to test.
 *
 * Everything is computed once, in the constructor, because every derived view
 * needs the same traversal and a notebook is read far more often than written.
 */

export interface Backlink {
  readonly slug: string;
  readonly title: string;
  /** The line the link appears on, for context. */
  readonly context: string;
}

export interface FolderNode {
  readonly name: string;
  /** Slug prefix: `books/philosophy`. */
  readonly path: string;
  readonly count: number;
  readonly children: readonly FolderNode[];
}

export class NoteCollection {
  /** Newest first. */
  readonly notes: readonly Note[];
  readonly tags: readonly TagNode[];
  readonly folders: readonly FolderNode[];

  private readonly bySlug = new Map<string, Note>();
  private readonly byKey = new Map<string, { note: Note; strength: number }>();
  private readonly backlinksBySlug = new Map<string, Backlink[]>();
  private readonly notesByTag = new Map<string, Note[]>();
  private readonly missing = new Set<string>();

  constructor(notes: readonly Note[]) {
    this.notes = [...notes].sort(byRecency);

    for (const note of this.notes) {
      this.bySlug.set(note.slug, note);
      this.indexLookupKeys(note);
      this.indexTags(note);
    }

    this.indexBacklinks();

    this.tags = buildTagTree(this.notes.map((note) => note.tags));
    this.folders = buildFolderTree(this.notes);
  }

  get size(): number {
    return this.notes.length;
  }

  get(slug: string): Note | undefined {
    return this.bySlug.get(slug);
  }

  has(slug: string): boolean {
    return this.bySlug.has(slug);
  }

  /**
   * Finds the note a wiki link points at.
   *
   * Candidates are tried in order of how deliberate they are: an exact slug
   * beats a title, which beats a bare file name, which beats an alias. Writing
   * `[[Stoicism]]` should find `philosophy/stoicism` without the reader having
   * to remember where they filed it.
   */
  resolve(target: string): Note | undefined {
    const direct = this.bySlug.get(target);
    if (direct) return direct;

    return this.byKey.get(linkKey(target))?.note;
  }

  backlinks(slug: string): readonly Backlink[] {
    return this.backlinksBySlug.get(slug) ?? [];
  }

  mentionCount(slug: string): number {
    return this.backlinks(slug).length;
  }

  /** Notes carrying this tag or any tag nested beneath it. */
  tagged(tag: string): readonly Note[] {
    return this.notesByTag.get(tag) ?? [];
  }

  get favorites(): readonly Note[] {
    return this.notes.filter((note) => note.frontmatter.favorite);
  }

  inFolder(folder: string): readonly Note[] {
    return folder === ''
      ? this.notes.filter((note) => note.folder === '')
      : this.notes.filter(
          (note) => note.folder === folder || note.folder.startsWith(`${folder}/`),
        );
  }

  recent(limit: number): readonly Note[] {
    return this.notes.slice(0, limit);
  }

  /**
   * The notes either side of this one, read as a sequence.
   *
   * A folder is treated as a run of pages and ordered by file name, so the
   * order is whatever `ls` would show and renaming a file is how you change it.
   * That is deliberately the cheapest possible answer: no ordering metadata to
   * keep in step with the files, and a vault from anywhere already has one.
   *
   * Only the folder's own notes count, not those in folders beneath it — a
   * subfolder is its own sequence rather than a continuation of this one.
   */
  neighbours(slug: string): { previous?: Note; next?: Note } {
    const note = this.bySlug.get(slug);
    if (!note) return {};

    const siblings = this.notes
      .filter((candidate) => candidate.folder === note.folder)
      .sort((a, b) => a.slug.localeCompare(b.slug));

    const at = siblings.findIndex((candidate) => candidate.slug === slug);

    return { previous: siblings[at - 1], next: siblings[at + 1] };
  }

  /**
   * Wiki link targets with no note behind them.
   *
   * These are the notebook's open questions — things referred to but not yet
   * written — so they are worth surfacing rather than hiding.
   */
  get unresolvedTargets(): readonly string[] {
    return [...this.missing].sort();
  }

  /**
   * A note chosen at random.
   *
   * The caller supplies the randomness so that callers who need a reproducible
   * result — tests, and anything server-rendered — can have one.
   */
  random(pick: () => number = Math.random): Note | undefined {
    if (this.notes.length === 0) return undefined;
    return this.notes[Math.floor(pick() * this.notes.length)];
  }

  private indexLookupKeys(note: Note): void {
    /**
     * Each candidate carries how deliberate a match through it would be. A
     * note's own slug outranks another note's alias no matter which order the
     * two are indexed in — without the ranking, whichever note happened to be
     * processed last would win, and link resolution would depend on edit
     * times. Ties keep the first entry, and because `notes` is sorted newest
     * first, that means the most recently edited note wins a real ambiguity.
     */
    const candidates: Array<[string, number]> = [
      [note.slug, 4],
      [note.title, 3],
      [baseNameOf(note.slug), 2],
      ...note.frontmatter.aliases.map((alias): [string, number] => [alias, 1]),
    ];

    for (const [candidate, strength] of candidates) {
      const key = linkKey(candidate);
      if (key === '') continue;

      const existing = this.byKey.get(key);
      if (!existing || strength > existing.strength) {
        this.byKey.set(key, { note, strength });
      }
    }
  }

  private indexTags(note: Note): void {
    const seen = new Set<string>();

    for (const tag of note.tags) {
      for (const ancestor of tagLineage(tag)) {
        if (seen.has(ancestor)) continue;
        seen.add(ancestor);

        const bucket = this.notesByTag.get(ancestor);
        if (bucket) bucket.push(note);
        else this.notesByTag.set(ancestor, [note]);
      }
    }
  }

  private indexBacklinks(): void {
    for (const source of this.notes) {
      // Two links from the same note to the same target are one mention.
      const recorded = new Set<string>();

      for (const link of source.links) {
        const destination = this.resolve(link.target);

        if (!destination) {
          this.missing.add(link.target);
          continue;
        }
        if (destination.slug === source.slug || recorded.has(destination.slug)) continue;
        recorded.add(destination.slug);

        const backlink = this.buildBacklink(source, link);
        const bucket = this.backlinksBySlug.get(destination.slug);
        if (bucket) bucket.push(backlink);
        else this.backlinksBySlug.set(destination.slug, [backlink]);
      }
    }
  }

  private buildBacklink(source: Note, link: WikiLink): Backlink {
    return {
      slug: source.slug,
      title: source.title,
      context: contextFor(source.body, link),
    };
  }
}

function buildFolderTree(notes: readonly Note[]): FolderNode[] {
  interface MutableFolder {
    name: string;
    path: string;
    count: number;
    children: Map<string, MutableFolder>;
  }

  const roots = new Map<string, MutableFolder>();

  for (const note of notes) {
    if (note.folder === '') continue;

    const segments = note.folder.split('/');
    let level = roots;

    for (let depth = 0; depth < segments.length; depth += 1) {
      const name = segments[depth];
      const path = segments.slice(0, depth + 1).join('/');

      let node = level.get(name);
      if (!node) {
        node = { name, path, count: 0, children: new Map() };
        level.set(name, node);
      }
      // Every folder on the way down contains this note.
      node.count += 1;
      level = node.children;
    }
  }

  const freeze = (level: Map<string, MutableFolder>): FolderNode[] =>
    [...level.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({
        name: node.name,
        path: node.path,
        count: node.count,
        children: freeze(node.children),
      }));

  return freeze(roots);
}
