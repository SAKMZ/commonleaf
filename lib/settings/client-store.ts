import { applySettings } from './apply';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  normaliseSettings,
  type Settings,
} from './types';
import { SYSTEM_THEME_PAIR, findTheme, themes } from '../theme/themes';

/**
 * Reader preferences, held outside React.
 *
 * `localStorage` and the document element are external systems, so the state
 * that mirrors them belongs outside the component tree; React subscribes to it
 * through `useSyncExternalStore`. Doing it this way means there is no context
 * provider, no cascade of re-renders at mount, and no hydration mismatch —
 * React is told explicitly that the server's snapshot is the defaults.
 *
 * It also means anything can read or change a setting: a keyboard shortcut, a
 * command-palette entry, or a future plugin, none of which are components.
 */

export interface SettingsSnapshot {
  readonly settings: Settings;
  /** The theme actually in use, with `system` resolved. */
  readonly themeId: string;
  readonly mode: 'light' | 'dark';
}

const listeners = new Set<() => void>();

/**
 * Built on first read and replaced — never mutated — on every change, because
 * `useSyncExternalStore` compares snapshots by identity.
 */
let snapshot: SettingsSnapshot | null = null;
let watchingSystemTheme = false;

const serverSnapshot: SettingsSnapshot = buildSnapshot(DEFAULT_SETTINGS, false);

function buildSnapshot(settings: Settings, systemIsDark: boolean): SettingsSnapshot {
  const known = themes.some((theme) => theme.id === settings.theme);
  const theme =
    settings.theme === 'system' || !known
      ? findTheme(systemIsDark ? SYSTEM_THEME_PAIR.dark : SYSTEM_THEME_PAIR.light)
      : findTheme(settings.theme);

  return { settings, themeId: theme.id, mode: theme.mode };
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function readStored(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? normaliseSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    // Private browsing, or storage disabled.
    return { ...DEFAULT_SETTINGS };
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Follows the operating system while `system` is selected.
 *
 * Attached on first subscription rather than at module load, so importing this
 * file has no side effects.
 */
function watchSystemTheme(): void {
  if (watchingSystemTheme || typeof window === 'undefined') return;
  watchingSystemTheme = true;

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    const current = getSnapshot();
    snapshot = buildSnapshot(current.settings, event.matches);
    applySettings(document.documentElement, snapshot.settings, {
      id: snapshot.themeId,
      mode: snapshot.mode,
    });
    emit();
  });
}

export function getSnapshot(): SettingsSnapshot {
  if (typeof window === 'undefined') return serverSnapshot;
  snapshot ??= buildSnapshot(readStored(), prefersDark());
  return snapshot;
}

export function getServerSnapshot(): SettingsSnapshot {
  return serverSnapshot;
}

export function subscribe(listener: () => void): () => void {
  watchSystemTheme();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateSettings(changes: Partial<Settings>): void {
  const current = getSnapshot();
  const settings = normaliseSettings({ ...current.settings, ...changes });
  snapshot = buildSnapshot(settings, prefersDark());

  // The document is updated here rather than in an effect: it is the external
  // system this store exists to drive, and the same function the pre-paint
  // bootstrap script uses.
  applySettings(document.documentElement, settings, {
    id: snapshot.themeId,
    mode: snapshot.mode,
  });

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The choice still applies for this session, which beats refusing it.
  }

  emit();
}

export function resetSettings(): void {
  updateSettings(DEFAULT_SETTINGS);
}
