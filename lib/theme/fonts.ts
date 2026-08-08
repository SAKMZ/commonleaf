/**
 * The font catalogue.
 *
 * Faces are loaded by `app/fonts.ts` through `next/font`, which self-hosts them
 * and exposes each one as a CSS variable. This module is the vocabulary the
 * settings screen and the generated stylesheet share: which faces exist, what
 * to call them, and which variable carries each one.
 *
 * Only the defaults are preloaded. The rest are fetched by the browser when a
 * reader actually selects them, so choosing from a long list costs nothing on
 * first paint.
 */

export type FontRole = 'reading' | 'editor' | 'display';

export interface FontChoice {
  readonly id: string;
  readonly label: string;
  /** The CSS variable declared by `next/font`, e.g. `--font-eb-garamond`. */
  readonly variable: string;
  /** Appended after the variable so text still renders if the face fails. */
  readonly fallback: string;
}

const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';
const MONO_FALLBACK = 'ui-monospace, "SFMono-Regular", Menlo, monospace';
const HAND_FALLBACK = 'ui-rounded, "Segoe Print", cursive';

export const readingFonts: readonly FontChoice[] = [
  {
    id: 'eb-garamond',
    label: 'EB Garamond',
    variable: '--font-eb-garamond',
    fallback: SERIF_FALLBACK,
  },
  {
    id: 'crimson-text',
    label: 'Crimson Text',
    variable: '--font-crimson-text',
    fallback: SERIF_FALLBACK,
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    variable: '--font-libre-baskerville',
    fallback: SERIF_FALLBACK,
  },
  {
    id: 'cormorant-garamond',
    label: 'Cormorant Garamond',
    variable: '--font-cormorant-garamond',
    fallback: SERIF_FALLBACK,
  },
  { id: 'lora', label: 'Lora', variable: '--font-lora', fallback: SERIF_FALLBACK },
] as const;

export const editorFonts: readonly FontChoice[] = [
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    variable: '--font-jetbrains-mono',
    fallback: MONO_FALLBACK,
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    variable: '--font-ibm-plex-mono',
    fallback: MONO_FALLBACK,
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    variable: '--font-fira-code',
    fallback: MONO_FALLBACK,
  },
] as const;

export const displayFonts: readonly FontChoice[] = [
  { id: 'caveat', label: 'Caveat', variable: '--font-caveat', fallback: HAND_FALLBACK },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    variable: '--font-patrick-hand',
    fallback: HAND_FALLBACK,
  },
  { id: 'kalam', label: 'Kalam', variable: '--font-kalam', fallback: HAND_FALLBACK },
  // Not every reader wants a handwritten heading; this keeps headings in the
  // reading face without needing a separate switch.
  {
    id: 'same-as-reading',
    label: 'Match body text',
    variable: '--font-reading-selected',
    fallback: SERIF_FALLBACK,
  },
] as const;

export const fontsByRole: Readonly<Record<FontRole, readonly FontChoice[]>> = {
  reading: readingFonts,
  editor: editorFonts,
  display: displayFonts,
};

export const DEFAULT_FONTS: Readonly<Record<FontRole, string>> = {
  reading: 'eb-garamond',
  editor: 'jetbrains-mono',
  display: 'caveat',
};

/** Faces loaded eagerly because they are the defaults on a first visit. */
export const PRELOADED_FONT_IDS: readonly string[] = [
  DEFAULT_FONTS.reading,
  DEFAULT_FONTS.editor,
  DEFAULT_FONTS.display,
];

export function findFont(role: FontRole, id: string): FontChoice {
  const choices = fontsByRole[role];
  return choices.find((choice) => choice.id === id) ?? choices[0];
}
