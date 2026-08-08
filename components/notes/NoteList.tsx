import Link from 'next/link';

import { relativeDate } from '@/lib/notes/dates';
import { routes } from '@/lib/notes/links';
import type { Note } from '@/lib/notes/note';

/**
 * A list of notes.
 *
 * The library, a tag, a folder and the favourites are all the same page with a
 * different set of notes in it, so they are all this component. Where they
 * differ is the heading, and that is the caller's business.
 */
export function NoteList({
  notes,
  empty = 'Nothing here yet.',
}: {
  notes: readonly Note[];
  /** Prose, or something to act on — an empty notebook wants a way out of it. */
  empty?: React.ReactNode;
}) {
  if (notes.length === 0) {
    return typeof empty === 'string' ? <p className="text-ink-muted italic">{empty}</p> : empty;
  }

  return (
    <ul className="space-y-7">
      {notes.map((note) => (
        <li key={note.slug}>
          <Link href={routes.note(note.slug)} className="group block">
            <h3 className="text-xl group-hover:underline">{note.title}</h3>

            {note.excerpt && <p className="text-ink-muted mt-1 text-base">{note.excerpt}</p>}

            <p className="text-ink-faint mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              <span>{relativeDate(note.frontmatter.updated || note.frontmatter.date)}</span>
              {note.folder && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{note.folder}</span>
                </>
              )}
              {note.frontmatter.favorite && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>favourite</span>
                </>
              )}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
