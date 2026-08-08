'use client';

import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { getServerSyncState, getSyncState, subscribeSync } from '@/lib/settings/client-store';

/**
 * Whether the notebook has the settings this device is showing.
 *
 * There is no Save button here — changes apply as they are made — so this line
 * is the only way to learn that the commit failed. It says nothing at all
 * until something has been changed, because "idle" is not news.
 */
export function SettingsSync() {
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);

  if (sync.status === 'idle') return null;

  if (sync.status === 'failed') {
    return (
      <p role="alert" className="text-ink-muted flex items-start gap-2 text-sm">
        <CloudOff size={15} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>
          {sync.message} These settings still apply on this device — they are just not in the
          notebook yet.
        </span>
      </p>
    );
  }

  return (
    <p className="text-ink-faint flex items-center gap-2 text-sm">
      {sync.status === 'saving' ? (
        <>
          <RefreshCw size={15} aria-hidden="true" />
          Saving to your notebook…
        </>
      ) : (
        <>
          <Check size={15} aria-hidden="true" />
          Saved to your notebook.
        </>
      )}
    </p>
  );
}
