import { NextResponse } from 'next/server';

import { handle, readJson, requireString } from '@/lib/api/errors';
import { ensureDailyNote } from '@/lib/notes/repository';

/**
 * The daily note for a date.
 *
 * The date comes from the browser rather than the server, because only the
 * reader's own device knows what "today" means for them.
 */
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    return NextResponse.json(await ensureDailyNote(requireString(body, 'date')));
  });
}
