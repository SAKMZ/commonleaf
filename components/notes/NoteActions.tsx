'use client';

import { Check, FolderInput, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, RequestError } from '@/lib/api/client';
import { routes } from '@/lib/notes/links';

/**
 * Renaming and deleting a note.
 *
 * Both live on the note itself rather than in the command palette. A palette
 * is a place you arrive by fuzzy match, and "Delete this note" one keystroke
 * away from "Daily note" is a trap; a destructive action should require you to
 * already be looking at the thing it destroys.
 */
export function NoteActions({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'moving' | 'deleting'>('idle');
  const [destination, setDestination] = useState(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (cause: unknown, fallback: string) => {
    setError(cause instanceof RequestError ? cause.message : fallback);
    setBusy(false);
  };

  const move = async () => {
    const to = destination.trim();
    if (to === '' || to === slug) return setMode('idle');

    setBusy(true);
    setError(null);

    try {
      const result = await api.moveNote(slug, to);
      router.replace(routes.note(result.slug));
      router.refresh();
    } catch (cause) {
      fail(cause, 'The note could not be moved.');
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.deleteNote(slug, title);
      router.replace(routes.home);
      router.refresh();
    } catch (cause) {
      fail(cause, 'The note could not be deleted.');
    }
  };

  if (mode === 'moving') {
    return (
      <Panel
        label="Move or rename"
        hint="The path inside your notebook, without the .md — for example books/atomic-habits."
        error={error}
      >
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void move();
          }}
        >
          <label className="sr-only" htmlFor="note-destination">
            New location
          </label>
          <input
            id="note-destination"
            className="border-rule bg-paper min-w-0 flex-1 border px-2 py-1 text-sm"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="text-accent text-sm underline" disabled={busy}>
            {busy ? 'Moving…' : 'Move'}
          </button>
          <button
            type="button"
            className="text-ink-faint text-sm underline"
            onClick={() => setMode('idle')}
          >
            Cancel
          </button>
        </form>
      </Panel>
    );
  }

  if (mode === 'deleting') {
    return (
      <Panel
        label={`Delete “${title}”?`}
        hint="The file is removed in a commit, so it stays in the repository's history."
        error={error}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-accent inline-flex items-center gap-1.5 text-sm underline"
            onClick={() => void remove()}
            disabled={busy}
          >
            <Check size={14} aria-hidden="true" />
            {busy ? 'Deleting…' : 'Delete it'}
          </button>
          <button
            type="button"
            className="text-ink-faint inline-flex items-center gap-1.5 text-sm underline"
            onClick={() => setMode('idle')}
          >
            <X size={14} aria-hidden="true" />
            Keep it
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="no-print mt-16 flex items-center gap-5">
      <button
        type="button"
        className="text-ink-faint hover:text-accent inline-flex items-center gap-1.5 text-sm"
        onClick={() => {
          setDestination(slug);
          setError(null);
          setMode('moving');
        }}
      >
        <FolderInput size={14} aria-hidden="true" />
        Move or rename
      </button>

      <button
        type="button"
        className="text-ink-faint hover:text-accent inline-flex items-center gap-1.5 text-sm"
        onClick={() => {
          setError(null);
          setMode('deleting');
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}

function Panel({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="border-rule no-print mt-16 border-t pt-5">
      <h2 className="index-heading mb-1">{label}</h2>
      <p className="text-ink-faint mb-3 text-sm">{hint}</p>
      {children}
      {error && (
        <p className="text-ink-muted mt-3 text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
