import { DEFAULT_FONTS } from '../theme/fonts';
import { DEFAULT_THEME_ID } from '../theme/themes';

/**
 * Reader preferences.
 *
 * These describe how a person likes to read, not what the notebook contains.
 * They are kept in two places: `localStorage`, which is written the instant
 * anything changes and is what the pre-paint script reads, and one JSON file
 * in the repository, written once the reader has stopped adjusting things.
 * See `document.ts` for how the two are reconciled.
 */
export interface Settings {
  /** A theme id, or `system` to follow the operating system. */
  theme: string;
  /** Paper grain, 0–100. */
  texture: number;
  readingFont: string;
  editorFont: string;
  displayFont: string;
  /** Body text size in pixels. */
  fontSize: number;
  lineHeight: number;
  /** Space between paragraphs, in ems of the body size. */
  paragraphSpacing: number;
  /** Measure of the text column in pixels. */
  readingWidth: number;
  animations: boolean;
  /** Milliseconds of quiet typing before an automatic save. */
  autosaveDelay: number;
  /** A pattern understood by `lib/notes/dates.ts`. */
  dateFormat: string;
  highContrast: boolean;
  /** Torn, uneven paper edge. */
  deckledEdges: boolean;
  /** Stitched binding down the left of the sheet. */
  binding: boolean;
  /** Ribbon bookmark marking the note you were last reading. */
  ribbon: boolean;
  /**
   * Whether the index sits open beside the page on a wide screen.
   *
   * A preference rather than component state so that it survives a reload and
   * is applied before the first paint — a sidebar that appears a moment after
   * the text does is worse than no sidebar. On narrow screens the index is a
   * drawer instead, and that is ordinary transient state.
   */
  sidebar: boolean;
  /**
   * The formatting buttons above the editor.
   *
   * On by default: the editor hides Markdown while you read it, and the
   * toolbar is how you produce it without knowing it. Someone fluent in the
   * syntax is better served by the space, so it can be turned off.
   */
  editorToolbar: boolean;
}

export const TEXTURE_STEPS = [0, 10, 25, 50, 75, 100] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME_ID,
  texture: 25,
  readingFont: DEFAULT_FONTS.reading,
  editorFont: DEFAULT_FONTS.editor,
  displayFont: DEFAULT_FONTS.display,
  fontSize: 19,
  lineHeight: 1.65,
  paragraphSpacing: 0.9,
  readingWidth: 720,
  animations: true,
  autosaveDelay: 2000,
  dateFormat: 'D MMMM YYYY',
  highContrast: false,
  deckledEdges: false,
  binding: false,
  ribbon: true,
  sidebar: true,
  editorToolbar: true,
};

/** The `localStorage` key holding the serialised {@link Settings}. */
export const SETTINGS_STORAGE_KEY = 'commonleaf.settings';

/** Bounds applied on load, so a hand-edited value cannot break the layout. */
const LIMITS = {
  texture: [0, 100],
  fontSize: [15, 26],
  lineHeight: [1.3, 2.2],
  paragraphSpacing: [0, 2],
  readingWidth: [560, 960],
  autosaveDelay: [500, 30000],
} as const satisfies Partial<Record<keyof Settings, readonly [number, number]>>;

function clampNumber(
  value: unknown,
  fallback: number,
  range: readonly [number, number],
): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, range[0]), range[1]);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

/**
 * Turns whatever is in storage into valid settings.
 *
 * Preferences saved by an older version, or edited by hand, must never leave
 * the reader staring at a broken page — unknown keys are dropped and invalid
 * values fall back to the default.
 */
export function normaliseSettings(input: unknown): Settings {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_SETTINGS };
  const raw = input as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;

  return {
    theme: asText(raw.theme, d.theme),
    texture: clampNumber(raw.texture, d.texture, LIMITS.texture),
    readingFont: asText(raw.readingFont, d.readingFont),
    editorFont: asText(raw.editorFont, d.editorFont),
    displayFont: asText(raw.displayFont, d.displayFont),
    fontSize: clampNumber(raw.fontSize, d.fontSize, LIMITS.fontSize),
    lineHeight: clampNumber(raw.lineHeight, d.lineHeight, LIMITS.lineHeight),
    paragraphSpacing: clampNumber(
      raw.paragraphSpacing,
      d.paragraphSpacing,
      LIMITS.paragraphSpacing,
    ),
    readingWidth: clampNumber(raw.readingWidth, d.readingWidth, LIMITS.readingWidth),
    animations: asBoolean(raw.animations, d.animations),
    autosaveDelay: clampNumber(raw.autosaveDelay, d.autosaveDelay, LIMITS.autosaveDelay),
    dateFormat: asText(raw.dateFormat, d.dateFormat),
    highContrast: asBoolean(raw.highContrast, d.highContrast),
    deckledEdges: asBoolean(raw.deckledEdges, d.deckledEdges),
    binding: asBoolean(raw.binding, d.binding),
    ribbon: asBoolean(raw.ribbon, d.ribbon),
    sidebar: asBoolean(raw.sidebar, d.sidebar),
    editorToolbar: asBoolean(raw.editorToolbar, d.editorToolbar),
  };
}
