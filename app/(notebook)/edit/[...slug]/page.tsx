import { notFound } from 'next/navigation';

import { NoteEditor } from '@/components/editor/NoteEditor';
import { folderOf, normaliseSlug } from '@/lib/notes/paths';
import { readRaw } from '@/lib/notes/repository';
import { getNotes } from '@/lib/notes/store';

/**
 * Writing a note.
 *
 * A separate route from reading, rather than a mode toggle on one page. The
 * reading view is a Server Component that ships no JavaScript; folding the
 * editor into it would mean sending CodeMirror to everyone who only wanted to
 * read. Because the editor renders Markdown live, the two look nearly
 * identical anyway — the seam is invisible in use and worth a great deal in
 * how much the reading view costs.
 */

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const safe = normaliseSlug(slug.join('/'));
  if (!safe) return {};

  const note = await readRaw(safe);
  return note ? { title: `Editing ${note.frontmatter.title}` } : {};
}

export default async function EditNotePage({ params }: PageProps) {
  const { slug } = await params;
  const safe = normaliseSlug(slug.join('/'));
  if (!safe) notFound();

  // Read straight from storage rather than from the index: the editor needs
  // the exact bytes and the exact blob SHA it will send back, and the index is
  // a derived view that may be a moment behind.
  const note = await readRaw(safe);
  if (!note) notFound();

  const collection = await getNotes();

  return (
    <main id="main">
      <NoteEditor
        // Remounting on a different note gives the editor a clean history and
        // avoids carrying one note's undo stack into another.
        key={safe}
        slug={safe}
        initialTitle={note.frontmatter.title}
        initialBody={note.body}
        initialSha={note.sha}
        folder={folderOf(safe)}
        existingNotes={collection.notes.map((item) => ({
          slug: item.slug,
          title: item.title,
        }))}
      />
    </main>
  );
}
