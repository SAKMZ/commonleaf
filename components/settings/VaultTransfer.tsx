'use client';

import { Download, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Fieldset } from '@/components/settings/controls';
import { api, RequestError } from '@/lib/api/client';
import type { ImportSummary } from '@/lib/vault/types';

/**
 * Taking the notebook away, and bringing one back.
 *
 * This is the escape hatch the whole project is built around, so it is a plain
 * button rather than something buried behind a warning: the notes are yours,
 * they are Markdown, and here they are.
 */
export function VaultTransfer() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importArchive = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const summary = await api.importVault(file, overwrite);
      setResult(summary);
      // The index has changed underneath every page, including the one behind
      // this form.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof RequestError ? cause.message : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Fieldset
      legend="Your notes"
      description="Not a device preference — this is the notebook itself."
    >
      <div className="flex flex-wrap items-center gap-3">
        {/*
         * Ordinary links, not fetches: the browser already knows how to
         * download a file, and streaming a large archive through JavaScript
         * only to hand it back would be slower and no more useful.
         */}
        <a
          href="/api/export"
          className="border-rule hover:border-ink-faint inline-flex items-center gap-2 border px-3 py-1.5 text-sm"
          download
        >
          <Download size={15} aria-hidden="true" />
          Download all notes (.zip)
        </a>

        <a href="/api/export?format=json" className="text-ink-faint text-sm underline" download>
          or as JSON
        </a>
      </div>

      <p className="text-ink-faint text-sm">
        Your Markdown files exactly as they are stored — any editor can open them. Pictures are
        not in the archive yet; they stay in the <code>images</code> folder of your repository.
      </p>

      <div className="border-rule mt-2 border-t pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="border-rule hover:border-ink-faint inline-flex items-center gap-2 border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} aria-hidden="true" />
            {busy ? 'Importing…' : 'Import a .zip'}
          </button>

          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-label="Choose a .zip archive to import"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importArchive(file);
            }}
          />

          <label className="text-ink-muted flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-accent h-4 w-4"
              checked={overwrite}
              onChange={(event) => setOverwrite(event.target.checked)}
            />
            Replace notes that already exist
          </label>
        </div>

        <p className="text-ink-faint mt-2 text-sm">
          Any folder of Markdown works — an Obsidian vault, a Jekyll site, or an archive from
          here. Files are added as they are; nothing is reformatted.
        </p>

        {result && (
          <p className="text-ink-muted mt-3 text-sm" role="status">
            {describe(result)}
          </p>
        )}

        {error && (
          <p className="text-ink-muted mt-3 text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
    </Fieldset>
  );
}

function describe(summary: ImportSummary): string {
  const parts: string[] = [];

  if (summary.added > 0) parts.push(`${summary.added} added`);
  if (summary.replaced > 0) parts.push(`${summary.replaced} replaced`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} already here`);
  if (summary.rejected.length > 0) parts.push(`${summary.rejected.length} skipped as unusable`);

  return parts.length === 0 ? 'Nothing to import.' : `Done: ${parts.join(', ')}.`;
}
