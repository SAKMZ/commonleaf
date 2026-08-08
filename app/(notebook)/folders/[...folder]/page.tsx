import { notFound } from 'next/navigation';
import Link from 'next/link';

import { NoteList } from '@/components/notes/NoteList';
import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { routes } from '@/lib/notes/links';
import { loadNotes } from '@/lib/notes/load';

/** Everything inside one folder, and the folders inside it. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ folder: string[] }>;
}

function folderFrom(segments: string[]): string {
  return segments.map(decodeURIComponent).join('/');
}

export async function generateMetadata({ params }: PageProps) {
  const { folder } = await params;
  return { title: folderFrom(folder) };
}

export default async function FolderPage({ params }: PageProps) {
  const { folder } = await params;
  const path = folderFrom(folder);

  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const notes = notebook.collection.inFolder(path);
  if (notes.length === 0) notFound();

  // Notes sitting directly in this folder, kept apart from those further down,
  // so a folder page reads like opening the folder rather than a flat search.
  const here = notes.filter((note) => note.folder === path);
  const below = notes.filter((note) => note.folder !== path);

  return (
    <Page wide>
      <PageHeader
        title={path}
        subtitle={notes.length === 1 ? 'One note' : `${notes.length} notes`}
      >
        <Breadcrumbs path={path} />
      </PageHeader>

      <NoteList notes={here} empty="No notes at this level." />

      {below.length > 0 && (
        <section className="border-rule mt-12 border-t pt-6" aria-labelledby="deeper">
          <h2 id="deeper" className="index-heading mb-6">
            Further in
          </h2>
          <NoteList notes={below} />
        </section>
      )}
    </Page>
  );
}

/** The path back up, since folders can nest arbitrarily deep. */
function Breadcrumbs({ path }: { path: string }) {
  const segments = path.split('/');
  if (segments.length < 2) return null;

  return (
    <nav aria-label="Parent folders" className="text-ink-faint mt-2 shrink-0 text-sm">
      {segments.slice(0, -1).map((segment, index) => (
        <span key={segment}>
          <Link
            href={routes.folder(segments.slice(0, index + 1).join('/'))}
            className="hover:text-accent"
          >
            {segment}
          </Link>
          <span aria-hidden="true"> / </span>
        </span>
      ))}
    </nav>
  );
}
