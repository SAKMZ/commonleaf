import { redirect } from 'next/navigation';

import { parseDate, toIsoDate } from '@/lib/notes/dates';
import { routes } from '@/lib/notes/links';
import { ensureDailyNote } from '@/lib/notes/repository';

/**
 * Opens the entry for a day, writing it if today is a blank page.
 *
 * `?date=` comes from the browser because the server's idea of "today" may be
 * hours out. It falls back to the server's date so that the URL still works
 * when typed by hand or opened from a bookmark.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('date');
  // A date that cannot be read is treated as "today" rather than as an error:
  // the reader asked for their journal, and refusing over a malformed query
  // string would be pedantry.
  const isoDate = (requested && parseDate(requested) && requested) || toIsoDate(new Date());

  const result = await ensureDailyNote(isoDate);

  redirect(routes.note(result.slug));
}
