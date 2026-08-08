import { applySettings } from './apply';
import { parseStoredSettings, sameSettings, serialiseStoredSettings } from './document';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  normaliseSettings,
  type Settings,
} from './types';
import { api, RequestError } from '../api/client';
import { SYSTEM_THEME_PAIR, findTheme, themes } from '../theme/themes';

/**
 * Reader preferences, held outside React.
 *
 * `localStorage`, the document element and the notebook are external systems,
 * so the state that mirrors them belongs outside the component tree; React
 * subscribes to it through `useSyncExternalStore`. Doing it this way means
 * there is no context provider, no cascade of re-renders at mount, and no
 * hydration mismatch — React is told explicitly that the server's snapshot is
 * the defaults, which is what the pre-paint script has already replaced.
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
    // The bootstrap script has already reconciled this with the notebook's
    // copy and written the winner back, so whatever is here is current.
    return raw
      ? (parseStoredSettings(raw)?.settings ?? { ...DEFAULT_SETTINGS })
      : { ...DEFAULT_SETTINGS };
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

  save(settings);
  emit();
}

export function resetSettings(): void {
  updateSettings(DEFAULT_SETTINGS);
}

/**
 * Writes the change to this device, then to the notebook.
 *
 * `localStorage` first and synchronously, because it is what makes the choice
 * survive a reload a moment later and what the pre-paint script reads. The
 * commit follows once the reader has stopped fiddling: dragging a slider
 * produces a change per pixel, and one commit per pixel would make the history
 * of a notebook unreadable.
 */
function save(settings: Settings): void {
  writeLocal(settings, Date.now());

  // Back to what the notebook already has — turning a toggle on and off again,
  // or trying a theme and returning to the first. The server would decline the
  // write anyway; not asking saves a round trip and a needless "Saving…".
  if (lastPushed && sameSettings(lastPushed, settings)) {
    clearTimeout(pendingWrite);
    pending = null;
    return;
  }

  pending = settings;

  clearTimeout(pendingWrite);
  pendingWrite = window.setTimeout(() => void push(settings), WRITE_DELAY);
  flushBeforeUnload();
}

/**
 * Sends whatever is still waiting when the page goes away.
 *
 * Choosing a theme and immediately navigating to look at it is the obvious
 * thing to do on this screen, and it happens well inside the delay. `keepalive`
 * is what lets the request outlive the document that started it; without this
 * the change would live on this device and never reach the notebook, because
 * nothing would ask again until the next time something was changed.
 */
function flushBeforeUnload(): void {
  if (watchingUnload) return;
  watchingUnload = true;

  window.addEventListener('pagehide', () => {
    if (!pending) return;
    clearTimeout(pendingWrite);
    void api.saveSettings(pending, { keepalive: true }).catch(() => {
      // Nothing can be reported to a page that is already gone.
    });
    pending = null;
  });
}

function writeLocal(settings: Settings, updatedAt: number): void {
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      serialiseStoredSettings({ settings, updatedAt }),
    );
  } catch {
    // The choice still applies for this session, which beats refusing it.
  }
}

/**
 * Records the settings in the notebook.
 *
 * On success the local timestamp is replaced by the server's, so that both
 * copies are dated by one clock and the next load does not think this device
 * is ahead of the notebook it just wrote to.
 *
 * On failure nothing is undone. A notebook that is read-only, unreachable, or
 * not configured yet is a perfectly ordinary state, and the reader's choice
 * has already been applied and stored here. The settings screen is where that
 * is reported, because it is the only place anyone is watching.
 */
async function push(settings: Settings): Promise<void> {
  setSyncState({ status: 'saving' });

  try {
    const stored = await api.saveSettings(settings);
    writeLocal(settings, stored.updatedAt);
    pending = null;
    lastPushed = settings;
    setSyncState({ status: 'saved' });
  } catch (cause) {
    setSyncState({
      status: 'failed',
      // The client's own network message talks about retrying a save, which
      // makes no sense on a screen with no Save button. Anything the server
      // actually said is worth repeating; a failure to reach it is not.
      message:
        cause instanceof RequestError && cause.code !== 'offline'
          ? cause.message
          : 'Your notebook could not be reached.',
    });
  }
}

/** How long the reader has to stop changing things before a commit. */
const WRITE_DELAY = 2000;

let pendingWrite: number | undefined;
let pending: Settings | null = null;
let watchingUnload = false;
/**
 * The last settings the notebook is known to hold, or `null` while that is
 * unknown — which it is until the first successful write, so a failed one is
 * always retried by the next change rather than mistaken for done.
 */
let lastPushed: Settings | null = null;

export interface SyncState {
  readonly status: 'idle' | 'saving' | 'saved' | 'failed';
  readonly message?: string;
}

const syncListeners = new Set<() => void>();
const IDLE: SyncState = { status: 'idle' };
let syncState: SyncState = IDLE;

function setSyncState(next: SyncState): void {
  syncState = next;
  for (const listener of syncListeners) listener();
}

export function getSyncState(): SyncState {
  return syncState;
}

export function getServerSyncState(): SyncState {
  return IDLE;
}

export function subscribeSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
