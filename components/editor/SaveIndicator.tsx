'use client';

import { AlertTriangle, Check, PenLine, RefreshCw } from 'lucide-react';

import { formatDate } from '@/lib/notes/dates';
import type { SaveState } from '@/hooks/useAutosave';

/**
 * What the editor says about whether the work is safe.
 *
 * Kept quiet on purpose. A save indicator that celebrates every success trains
 * people to ignore it, which is precisely when it matters. This one is a
 * murmur when things are fine and speaks up only when they are not.
 */
export function SaveIndicator({ state }: { state: SaveState }) {
  const common = 'flex items-center gap-1.5 text-xs';

  switch (state.status) {
    case 'saved':
      return (
        <p className={`${common} text-ink-faint`} role="status">
          <Check size={13} aria-hidden="true" />
          {state.at ? `Saved at ${formatDate(state.at, 'HH:mm')}` : 'Saved'}
        </p>
      );

    case 'dirty':
      return (
        <p className={`${common} text-ink-faint`} role="status">
          <PenLine size={13} aria-hidden="true" />
          Unsaved
        </p>
      );

    case 'saving':
      return (
        <p className={`${common} text-ink-faint`} role="status">
          <RefreshCw size={13} aria-hidden="true" className="motion-safe:animate-spin" />
          Saving
        </p>
      );

    case 'error':
      return (
        // `alert` rather than `status`: a failed save is worth interrupting for.
        <p className={`${common} text-accent`} role="alert">
          <AlertTriangle size={13} aria-hidden="true" />
          {state.conflict ? 'Changed elsewhere' : 'Not saved'}
        </p>
      );
  }
}
