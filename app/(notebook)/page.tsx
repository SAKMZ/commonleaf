import { NoteList } from '@/components/notes/NoteList';
import { Page } from '@/components/Page';
import { SetupNeeded } from '@/components/SetupNeeded';
import { branding } from '@/lib/branding';
import { loadNotes } from '@/lib/notes/load';

/** The library: what you were last working on. */
export const dynamic = 'force-dynamic';

const RECENT_LIMIT = 12;

export default async function HomePage() {
  const notebook = await loadNotes();
  if (!notebook.ok) return <SetupNeeded error={notebook.error} />;

  const recent = notebook.collection.recent(RECENT_LIMIT);

  return (
    <Page>
      <header className="mb-10">
        <h1 className="font-display text-5xl leading-none">{branding.name}</h1>
        <p className="text-ink-muted mt-3 text-lg italic">{branding.tagline}</p>
      </header>

      <hr className="rule-ornament my-10" />

      <section aria-labelledby="recent">
        <h2 id="recent" className="index-heading mb-6">
          Recently written
        </h2>

        <NoteList
          notes={recent}
          empty="The notebook is empty. Press ⌘K and type a title to write the first note."
        />
      </section>
    </Page>
  );
}
