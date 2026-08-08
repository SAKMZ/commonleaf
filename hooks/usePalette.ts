'use client';

import { useSyncExternalStore } from 'react';

import {
  getPaletteState,
  getServerPaletteState,
  subscribePalette,
  type PaletteState,
} from '@/lib/palette/store';

export function usePalette(): PaletteState {
  return useSyncExternalStore(subscribePalette, getPaletteState, getServerPaletteState);
}
