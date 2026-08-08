import { normaliseSettings, type Settings } from './types';

/**
 * Settings as a file in the notebook.
 *
 * Preferences used to live only in `localStorage`, which meant a new browser
 * started from scratch and a lost laptop lost the setup with it. They are now
 * kept in the repository too, in one small JSON file beside the notes, so the
 * notebook carries how it is meant to be read as well as what is in it.
 *
 * The file is deliberately not a note: it is not Markdown, it is not in the
 * content directory, and nothing in the index will ever see it. Everything
 * here is pure — reading and writing the file is `server-store.ts`.
 */

/** Repository root, beside the content directory rather than inside it. */
export const SETTINGS_PATH = 'commonleaf.json';

export interface StoredSettings {
  readonly settings: Settings;
  /**
   * Epoch milliseconds, and the whole conflict-resolution strategy: whichever
   * copy was written last wins. Two devices with badly wrong clocks can
   * therefore disagree about which is newer, which is a price worth paying to
   * avoid inventing a merge protocol for one person's font size.
   */
  readonly updatedAt: number;
}

interface FileShape {
  version: number;
  updatedAt: string;
  settings: Settings;
}

/**
 * Reads whatever was found, from the file or from `localStorage`.
 *
 * Forgiving in the same way note parsing is: a file written by an older
 * version, edited by hand, or half-written by a crashed browser must never
 * leave the reader staring at a broken page. Anything unusable is `null`,
 * which every caller already has to handle for "no file yet".
 *
 * A bare settings object with no envelope is what `localStorage` held before
 * this file existed, and is read as "written at the beginning of time" so that
 * anything in the notebook takes precedence over it exactly once.
 */
export function parseStoredSettings(raw: string): StoredSettings | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const envelope = parsed as Partial<FileShape>;

  const legacy = envelope.settings === undefined;
  const settings = normaliseSettings(legacy ? parsed : envelope.settings);
  const updatedAt = legacy ? 0 : Date.parse(String(envelope.updatedAt));

  return { settings, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 };
}

/**
 * The bytes to store.
 *
 * Indented and newline-terminated because this is a file someone may open, and
 * an ISO timestamp for the same reason — a number of milliseconds tells a
 * human nothing. `normaliseSettings` fixes the key order, so saving the same
 * settings twice produces no diff.
 */
export function serialiseStoredSettings({ settings, updatedAt }: StoredSettings): string {
  const file: FileShape = {
    version: 1,
    updatedAt: new Date(updatedAt).toISOString(),
    settings: normaliseSettings(settings),
  };

  return `${JSON.stringify(file, null, 2)}\n`;
}

/** The newer of the two, preferring the notebook when they are the same age. */
export function newerOf(
  local: StoredSettings | null,
  remote: StoredSettings | null,
): StoredSettings | null {
  if (!local) return remote;
  if (!remote) return local;
  return local.updatedAt > remote.updatedAt ? local : remote;
}
