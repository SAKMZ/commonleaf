import { describe, expect, it } from 'vitest';

import {
  newerOf,
  parseStoredSettings,
  serialiseStoredSettings,
  type StoredSettings,
} from '@/lib/settings/document';
import { DEFAULT_SETTINGS } from '@/lib/settings/types';

/**
 * The settings file is read from a repository anyone can edit by hand, and
 * from `localStorage` written by every version this notebook has ever been
 * opened with. Neither is trusted; both must produce something usable.
 */

function stored(overrides: Partial<StoredSettings> = {}): StoredSettings {
  return { settings: DEFAULT_SETTINGS, updatedAt: 1_000, ...overrides };
}

describe('serialiseStoredSettings', () => {
  it('round-trips', () => {
    const original = stored({ settings: { ...DEFAULT_SETTINGS, fontSize: 22 } });
    const parsed = parseStoredSettings(serialiseStoredSettings(original));

    expect(parsed?.settings.fontSize).toBe(22);
    expect(parsed?.updatedAt).toBe(original.updatedAt);
  });

  it('writes the same bytes for the same settings, so saving twice is no diff', () => {
    const at = 1_700_000_000_000;

    expect(serialiseStoredSettings({ settings: DEFAULT_SETTINGS, updatedAt: at })).toBe(
      serialiseStoredSettings({ settings: { ...DEFAULT_SETTINGS }, updatedAt: at }),
    );
  });

  it('is readable, and ends with a newline like every other file here', () => {
    const text = serialiseStoredSettings(stored());

    expect(text).toContain('\n  "version": 1');
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('parseStoredSettings', () => {
  it('gives up on anything that is not an object', () => {
    expect(parseStoredSettings('not json')).toBeNull();
    expect(parseStoredSettings('null')).toBeNull();
    expect(parseStoredSettings('[1, 2]')?.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('repairs values that would break the page', () => {
    const parsed = parseStoredSettings(
      '{"version":1,"updatedAt":"2026-01-01T00:00:00.000Z","settings":{"fontSize":9000}}',
    );

    expect(parsed?.settings.fontSize).toBe(26);
  });

  it('reads a bare settings object as the oldest possible copy', () => {
    // What `localStorage` held before the notebook did. Dating it at zero is
    // what lets the repository win the comparison exactly once.
    const parsed = parseStoredSettings('{"fontSize":21}');

    expect(parsed?.settings.fontSize).toBe(21);
    expect(parsed?.updatedAt).toBe(0);
  });

  it('survives a timestamp that is not one', () => {
    expect(parseStoredSettings('{"updatedAt":"whenever","settings":{}}')?.updatedAt).toBe(0);
  });
});

describe('newerOf', () => {
  it('takes whichever was written last', () => {
    const older = stored({ updatedAt: 1 });
    const newer = stored({ updatedAt: 2 });

    expect(newerOf(older, newer)).toBe(newer);
    expect(newerOf(newer, older)).toBe(newer);
  });

  it('takes whichever exists', () => {
    const only = stored();

    expect(newerOf(null, only)).toBe(only);
    expect(newerOf(only, null)).toBe(only);
    expect(newerOf(null, null)).toBeNull();
  });

  it('prefers the notebook when the two are the same age', () => {
    const local = stored();
    const remote = stored();

    expect(newerOf(local, remote)).toBe(remote);
  });
});
