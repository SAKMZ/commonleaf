import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NoteMarkdown } from '@/components/markdown/NoteMarkdown';
import { RestoreRevision } from '@/components/notes/RestoreRevision';
import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { formatDate } from '@/lib/notes/dates';
import { routes, wikiLinkResolver } from '@/lib/notes/links';
import { loadNotes } from '@/lib/notes/load';
import { normaliseSlug } from '@/lib/notes/paths';
import { noteAtRevision, noteHistory } from '@/lib/notes/repository';

/**
 * Every version of a note, read out of the Git log.
 *
 * Nothing was built to make this work: the repository has always been the
 * database, so the history was already there. Drivers that cannot provide it
 * say so rather than pretending the note has none.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ rev?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return { title: `History of ${slug.map(decodeURIComponent).join('/')}` };
}

export default async function HistoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { rev } = await searchParams;
  const safe = normaliseSlug(slug.map(decodeURIComponent).join('/'));
  if (!safe) notFound();

  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const note = notebook.collection.get(safe);
  if (!note) notFound();

  const revisions = await noteHistory(safe);
  const selected = rev ? await noteAtRevision(safe, rev) : null;

  return (
    <Page wide>
      <PageHeader title={note.title} subtitle="History">
        <Link
          href={routes.note(note.slug)}
          className="text-ink-faint hover:text-accent mt-2 inline-flex shrink-0 items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to the note
        </Link>
      </PageHeader>

      {revisions.length === 0 ? (
        <p className="text-ink-muted italic">
          No history is available. This storage driver cannot read the Git log — the filesystem
          driver needs the content directory to be inside a Git working tree.
        </p>
      ) : (
        <ol className="space-y-1">
          {revisions.map((revision) => {
            const current = revision.sha === rev;

            return (
              <li key={revision.sha}>
                <Link
                  href={
                    current
                      ? routes.history(note.slug)
                      : `${routes.history(note.slug)}?rev=${encodeURIComponent(revision.sha)}`
                  }
                  className="index-link"
                  aria-current={current ? 'true' : undefined}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{revision.message}</span>
                    <span className="text-ink-faint text-sm">
                      {formatDate(revision.date, 'D MMM YYYY, HH:mm')} · {revision.author}
                    </span>
                  </span>
                  <code className="index-count">{revision.sha.slice(0, 7)}</code>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {rev && (
        <section className="border-rule mt-12 border-t pt-8" aria-labelledby="version">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="version" className="index-heading">
              As it stood at {rev.slice(0, 7)}
            </h2>

            {selected && (
              <RestoreRevision slug={note.slug} body={selected.body} sha={note.sha} />
            )}
          </div>

          {selected ? (
            <NoteMarkdown
              content={selected.body}
              folder={note.folder}
              resolveWikiLink={wikiLinkResolver(notebook.collection)}
            />
          ) : (
            <p className="text-ink-muted italic">The note did not exist at this revision.</p>
          )}
        </section>
      )}
    </Page>
  );
}
