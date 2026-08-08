/**
 * Whether the palette is open, held outside React.
 *
 * The same reasoning as the settings store: a keyboard shortcut registered on
 * `document`, a button in the bar, and a link inside a note are all things that
 * might open the palette, and only one of them is a component. Keeping the flag
 * outside the tree means none of them need to be near each other.
 */

export type PaletteMode = 'search' | 'commands';

export interface PaletteState {
  readonly open: boolean;
  readonly mode: PaletteMode;
}

const CLOSED: PaletteState = { open: false, mode: 'search' };

const listeners = new Set<() => void>();
let state: PaletteState = CLOSED;

function set(next: PaletteState): void {
  if (next.open === state.open && next.mode === state.mode) return;
  state = next;
  for (const listener of listeners) listener();
}

export function getPaletteState(): PaletteState {
  return state;
}

/** Server renders never show the palette, so the snapshot is always closed. */
export function getServerPaletteState(): PaletteState {
  return CLOSED;
}

export function subscribePalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openPalette(mode: PaletteMode = 'search'): void {
  set({ open: true, mode });
}

export function closePalette(): void {
  set(CLOSED);
}

/** Opening the palette in the mode it is already in closes it again. */
export function togglePalette(mode: PaletteMode = 'search'): void {
  if (state.open && state.mode === mode) closePalette();
  else openPalette(mode);
}
