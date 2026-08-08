import Link from 'next/link';

import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { routes } from '@/lib/notes/links';
import { loadNotes } from '@/lib/notes/load';
import { slugifyPath } from '@/lib/notes/paths';

/**
 * Links pointing at notes that do not exist yet.
 *
 * The most useful page in the notebook once it has been going a while: these
 * are the things you thought were worth naming and have not written down.
 */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Unwritten' };

export default async function UnwrittenPage() {
  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const targets = notebook.collection.unresolvedTargets;

  return (
    <Page wide>
      <PageHeader
        title="Unwritten"
        subtitle="Wiki links with nothing behind them yet — the notebook's open questions."
      />

      {targets.length === 0 ? (
        <p className="text-ink-muted italic">
          Every link leads somewhere. Nothing is waiting to be written.
        </p>
      ) : (
        <ul className="space-y-3">
          {targets.map((target) => (
            <li key={target}>
              {/*
               * Following the link lands on the note's own page, which offers
               * to write it — the same path as clicking the link inside a
               * note, rather than a second way of doing the same thing.
               */}
              <Link
                href={routes.note(slugifyPath(target))}
                className="text-accent hover:underline"
              >
                {target}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
