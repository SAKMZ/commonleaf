'use client';

import { PenLine } from 'lucide-react';

import { openPalette } from '@/lib/palette/store';

/**
 * The way out of an empty notebook.
 *
 * An empty state that names a keyboard shortcut is an instruction; this is a
 * button. It opens the same palette the shortcut does, so there is still only
 * one way a note gets named.
 */
export function StartWriting({ label = 'Write the first note' }: { label?: string }) {
  return (
    <div>
      <p className="text-ink-muted italic">Nothing here yet.</p>

      <button
        type="button"
        className="border-rule hover:border-ink-faint mt-4 inline-flex items-center gap-2 border px-4 py-2"
        onClick={() => openPalette('create')}
      >
        <PenLine size={16} aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
