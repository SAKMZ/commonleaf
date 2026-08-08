'use client';

import { useSyncExternalStore } from 'react';

import {
  getServerSnapshot,
  getSnapshot,
  resetSettings,
  subscribe,
  updateSettings,
  type SettingsSnapshot,
} from '@/lib/settings/client-store';

export interface UseSettings extends SettingsSnapshot {
  update: typeof updateSettings;
  reset: typeof resetSettings;
}

/**
 * Reader preferences.
 *
 * No provider is needed: the store lives outside React and any component can
 * subscribe to it directly. Server renders receive the defaults, which is what
 * the root layout puts in the HTML, so hydration matches — and the pre-paint
 * bootstrap script has already applied the reader's real settings to the
 * document by then.
 */
export function useSettings(): UseSettings {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snapshot, update: updateSettings, reset: resetSettings };
}
