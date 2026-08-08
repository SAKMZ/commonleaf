import { NoteList } from '@/components/notes/NoteList';
import { Page, PageHeader } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { loadNotes } from '@/lib/notes/load';

/** The notes marked `favorite: true`. */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Favourites' };

export default async function FavoritesPage() {
  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  return (
    <Page wide>
      <PageHeader title="Favourites" subtitle="The ones you keep coming back to." />

      <NoteList
        notes={notebook.collection.favorites}
        empty="Nothing marked yet. Set favorite: true in a note's frontmatter."
      />
    </Page>
  );
}
