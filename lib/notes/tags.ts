import { normaliseTag } from './frontmatter';
import { withoutCode } from './markdown-text';

/**
 * Tags, in frontmatter and inline.
 *
 * Nesting is expressed with slashes — `books/philosophy`, `python/web` — and
 * is a naming convention rather than a data structure: the tree is derived
 * when the index is built, so renaming a tag is a find-and-replace in plain
 * text and nothing needs migrating.
 */

export interface TagNode {
  /** The last segment: `philosophy`. */
  readonly name: string;
  /** The full tag: `books/philosophy`. */
  readonly path: string;
  /** Notes carrying this exact tag. */
  readonly count: number;
  /** Notes carrying this tag or any tag beneath it. */
  readonly totalCount: number;
  readonly children: readonly TagNode[];
}

/**
 * An inline tag starts at a word boundary so that `#` in `example.com/#top`
 * and in a `# Heading` is left alone. The first character after `#` must be a
 * letter, which is what separates `#books` from an issue reference like `#42`.
 */
const INLINE_TAG = /(^|[\s(])#(\p{L}[\p{L}\p{N}_-]*(?:\/[\p{L}\p{N}_-]+)*)/gu;

export function extractInlineTags(body: string): string[] {
  const found = new Set<string>();

  for (const match of withoutCode(body).matchAll(INLINE_TAG)) {
    const tag = normaliseTag(match[2]);
    if (tag !== '') found.add(tag);
  }

  return [...found];
}

/** Every ancestor of a tag, including itself: `a/b/c` → `a`, `a/b`, `a/b/c`. */
export function tagLineage(tag: string): string[] {
  const segments = tag.split('/');
  return segments.map((_segment, index) => segments.slice(0, index + 1).join('/'));
}

interface MutableNode {
  name: string;
  path: string;
  count: number;
  totalCount: number;
  children: Map<string, MutableNode>;
}

/**
 * Builds the tag tree from the tags of every note.
 *
 * A note tagged `books/philosophy` contributes to the count of `books` as well,
 * because a reader clicking `books` expects to see everything filed under it.
 */
export function buildTagTree(taggedNotes: readonly (readonly string[])[]): TagNode[] {
  const roots = new Map<string, MutableNode>();

  const nodeFor = (path: string): MutableNode => {
    const segments = path.split('/');
    let level = roots;
    let node: MutableNode | undefined;

    for (let depth = 0; depth < segments.length; depth += 1) {
      const name = segments[depth];
      const fullPath = segments.slice(0, depth + 1).join('/');

      node = level.get(name);
      if (!node) {
        node = { name, path: fullPath, count: 0, totalCount: 0, children: new Map() };
        level.set(name, node);
      }
      level = node.children;
    }

    return node!;
  };

  for (const tags of taggedNotes) {
    // A note tagged both `a/b` and `a` must only count once towards `a`.
    const counted = new Set<string>();

    for (const tag of tags) {
      nodeFor(tag).count += 1;

      for (const ancestor of tagLineage(tag)) {
        if (counted.has(ancestor)) continue;
        counted.add(ancestor);
        nodeFor(ancestor).totalCount += 1;
      }
    }
  }

  const freeze = (level: Map<string, MutableNode>): TagNode[] =>
    [...level.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({
        name: node.name,
        path: node.path,
        count: node.count,
        totalCount: node.totalCount,
        children: freeze(node.children),
      }));

  return freeze(roots);
}

/** Flattens the tree back to a depth-first list, for menus and counts. */
export function flattenTags(nodes: readonly TagNode[]): TagNode[] {
  return nodes.flatMap((node) => [node, ...flattenTags(node.children)]);
}
