/**
 * Cheap, syntax-aware text handling used while building the index.
 *
 * These functions run over every note on every index rebuild, so they work on
 * the raw string rather than parsing to an AST. They only need to be right
 * about the two things the index depends on — where code lives, and roughly
 * what the prose says — not to be a Markdown implementation.
 */

/** Fenced blocks, indented blocks and inline spans, replaced with blanks. */
export function withoutCode(markdown: string): string {
  return (
    markdown
      // Fenced blocks, including ~~~ and any info string.
      .replace(/^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[^\n]*$/gm, '')
      // Unclosed fence running to the end of the file.
      .replace(/^(?:```|~~~)[^\n]*\n[\s\S]*$/m, '')
      // Inline spans, longest run of backticks first.
      .replace(/`{1,3}[^`\n]*`{1,3}/g, '')
  );
}

/** Strips Markdown decoration to leave something readable as a summary. */
export function toPlainText(markdown: string): string {
  return withoutCode(markdown)
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, target, label) =>
      String(label ?? target),
    )
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The opening of a note, for list views and search results.
 *
 * Cut at a word boundary and use a real ellipsis; a summary that ends
 * mid-syllable looks like a bug.
 */
export function excerptOf(markdown: string, maxLength = 180): string {
  const text = toPlainText(markdown);
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function countWords(markdown: string): number {
  const text = toPlainText(markdown);
  return text === '' ? 0 : text.split(/\s+/).length;
}

/**
 * Minutes to read, rounded up.
 *
 * 200 words per minute is the conventional figure for prose. It is an estimate
 * on the cover of a note, not a measurement, so precision would be false.
 *
 * An empty note takes no time to read. Rounding it up to "1 min" would be a
 * small lie printed on every note that has not been written yet.
 */
export function readingMinutes(wordCount: number): number {
  return wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 200));
}

/** The line a match sits on, trimmed — used to show backlinks in context. */
export function lineContaining(markdown: string, index: number): string {
  const start = markdown.lastIndexOf('\n', index) + 1;
  const end = markdown.indexOf('\n', index);
  return markdown.slice(start, end === -1 ? undefined : end).trim();
}
