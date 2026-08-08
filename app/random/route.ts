import { redirect } from 'next/navigation';

import { routes } from '@/lib/notes/links';
import { getNotes } from '@/lib/notes/store';

/**
 * Sends the reader to a note chosen at random.
 *
 * A redirect rather than a page, so that the address bar ends up on the note
 * itself: reloading rereads that note instead of shuffling again, and the note
 * can be linked to or kept open like any other.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const collection = await getNotes();
  const note = collection.random();

  redirect(note ? routes.note(note.slug) : routes.home);
}
