'use client';

import { Feather } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, RequestError } from '@/lib/api/client';
import { routes } from '@/lib/notes/links';

/**
 * Offers to write a note that a link points at but nobody has written.
 *
 * This is what keeps `[[Stoicism]]` a promise rather than a dead end: the page
 * exists as soon as it is named, and following the link is how you start it.
 */
export function WriteThisNote({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);

    try {
      await api.createNote({ title, slug });
      // `replace`, not `push`: the empty page should not be somewhere the back
      // button can return to, because it will no longer be true.
      router.replace(routes.edit(slug));
    } catch (cause) {
      setError(
        cause instanceof RequestError ? cause.message : 'The note could not be created.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        className="border-rule hover:border-ink-faint inline-flex items-center gap-2 border px-4 py-2"
        onClick={create}
        disabled={busy}
      >
        <Feather size={16} aria-hidden="true" />
        {busy ? 'Writing…' : 'Write this note'}
      </button>

      {error && (
        <p role="alert" className="text-ink-muted mt-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
