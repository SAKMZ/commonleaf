import { History, Pencil } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NoteMarkdown } from '@/components/markdown/NoteMarkdown';
import { NoteActions } from '@/components/notes/NoteActions';
import { PageTurn } from '@/components/notes/PageTurn';
import { WriteThisNote } from '@/components/notes/WriteThisNote';
import { Page } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { formatDate } from '@/lib/notes/dates';
import { routes, wikiLinkResolver } from '@/lib/notes/links';
import { loadNotes } from '@/lib/notes/load';
import { normaliseSlug, titleFromSlug } from '@/lib/notes/paths';

/**
 * Reading a note.
 *
 * A Server Component: the Markdown is parsed and rendered on the server, so a
 * reader downloads HTML and no parser at all. The only JavaScript on this page
 * is the shell around it.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const safe = normaliseSlug(slug.map(decodeURIComponent).join('/'));
  if (!safe) return {};

  const notebook = await loadNotes();
  const note = notebook.ok ? notebook.collection.get(safe) : undefined;

  return { title: note?.title ?? titleFromSlug(safe) };
}

export default async function NotePage({ params }: PageProps) {
  const { slug } = await params;
  const safe = normaliseSlug(slug.map(decodeURIComponent).join('/'));
  if (!safe) notFound();

  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const collection = notebook.collection;
  const note = collection.get(safe);

  // A note that does not exist is an invitation rather than an error: this is
  // where a wiki link to something unwritten lands.
  if (!note) return <Unwritten slug={safe} />;

  const backlinks = collection.backlinks(note.slug);
  const { previous, next } = collection.neighbours(note.slug);

  return (
    <Page>
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-4xl leading-tight">{note.title}</h1>

          <div className="no-print mt-2 flex shrink-0 gap-1">
            <Link
              href={routes.history(note.slug)}
              className="text-ink-faint hover:text-accent p-1"
              title="History"
            >
              <History size={16} aria-hidden="true" />
              <span className="sr-only">History</span>
            </Link>
            <Link
              href={routes.edit(note.slug)}
              className="text-ink-faint hover:text-accent p-1"
              title="Edit"
            >
              <Pencil size={16} aria-hidden="true" />
              <span className="sr-only">Edit</span>
            </Link>
          </div>
        </div>

        <p className="text-ink-faint mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {note.frontmatter.date && (
            <time dateTime={note.frontmatter.date}>{formatDate(note.frontmatter.date)}</time>
          )}
          {note.readingTime > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{note.readingTime} min read</span>
            </>
          )}
          {note.frontmatter.author && (
            <>
              <span aria-hidden="true">·</span>
              <span>{note.frontmatter.author}</span>
            </>
          )}
        </p>

        {note.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {note.tags.map((tag) => (
              <li key={tag}>
                <Link href={routes.tag(tag)} className="text-accent hover:underline">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      <NoteMarkdown
        content={note.body}
        folder={note.folder}
        resolveWikiLink={wikiLinkResolver(collection)}
      />

      {backlinks.length > 0 && (
        <section className="border-rule mt-16 border-t pt-6" aria-labelledby="backlinks">
          <h2 id="backlinks" className="index-heading">
            {backlinks.length === 1 ? '1 mention' : `${backlinks.length} mentions`}
          </h2>

          <ul className="mt-4 space-y-4">
            {backlinks.map((backlink) => (
              <li key={backlink.slug}>
                <Link href={routes.note(backlink.slug)} className="text-accent hover:underline">
                  {backlink.title}
                </Link>
                {backlink.context && (
                  <p className="text-ink-muted mt-1 text-sm italic">{backlink.context}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Last, because turning the page is what you do having finished this one. */}
      <PageTurn previous={previous} next={next} />

      <NoteActions slug={note.slug} title={note.title} />
    </Page>
  );
}

function Unwritten({ slug }: { slug: string }) {
  const title = titleFromSlug(slug);

  return (
    <Page>
      <h1 className="font-display text-ink-muted text-4xl leading-tight">{title}</h1>

      <div className="reading mt-6">
        <p>
          This note has not been written yet. It has a name and a place — <code>{slug}.md</code>{' '}
          — and nothing in it.
        </p>
      </div>

      <WriteThisNote slug={slug} title={title} />
    </Page>
  );
}
