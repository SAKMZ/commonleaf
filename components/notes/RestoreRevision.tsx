'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, RequestError } from '@/lib/api/client';
import { routes } from '@/lib/notes/links';

/**
 * Puts an old version back.
 *
 * Restoring writes a new commit rather than rewinding the branch: the history
 * of a notebook should only ever grow, and undoing a restore is then just
 * another restore. The frontmatter is left to the server to merge, so
 * restoring the prose does not also restore a stale `updated` stamp.
 */
export function RestoreRevision({
  slug,
  body,
  sha,
}: {
  slug: string;
  /** The prose as it stood at the chosen revision. */
  body: string;
  /** The blob SHA of the note as it stands now, for conflict detection. */
  sha: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirming' | 'busy'>('idle');
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    setState('busy');
    setError(null);

    try {
      await api.saveNote(slug, { body, expectedSha: sha });
      router.push(routes.note(slug));
    } catch (cause) {
      setError(
        cause instanceof RequestError ? cause.message : 'The version could not be restored.',
      );
      setState('idle');
    }
  };

  if (state === 'confirming') {
    return (
      <span className="flex items-center gap-3 text-sm">
        <span className="text-ink-muted">Replace the current text?</span>
        <button type="button" className="text-accent underline" onClick={restore}>
          Restore
        </button>
        <button
          type="button"
          className="text-ink-faint underline"
          onClick={() => setState('idle')}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        className="text-ink-faint hover:text-accent inline-flex items-center gap-1.5 text-sm"
        onClick={() => setState('confirming')}
        disabled={state === 'busy'}
      >
        <RotateCcw size={14} aria-hidden="true" />
        {state === 'busy' ? 'Restoring…' : 'Restore this version'}
      </button>

      {error && (
        <span role="alert" className="text-ink-muted text-sm">
          {error}
        </span>
      )}
    </span>
  );
}
