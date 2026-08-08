import { notFound } from 'next/navigation';

import { NoteList } from '@/components/notes/NoteList';
import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { loadNotes } from '@/lib/notes/load';

/** Everything filed under one tag, including tags nested beneath it. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ tag: string[] }>;
}

function tagFrom(segments: string[]): string {
  return segments.map(decodeURIComponent).join('/');
}

export async function generateMetadata({ params }: PageProps) {
  const { tag } = await params;
  return { title: `#${tagFrom(tag)}` };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const path = tagFrom(tag);

  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const notes = notebook.collection.tagged(path);
  if (notes.length === 0) notFound();

  return (
    <Page wide>
      <PageHeader
        title={`#${path}`}
        subtitle={notes.length === 1 ? 'One note' : `${notes.length} notes`}
      />

      <NoteList notes={notes} />
    </Page>
  );
}
