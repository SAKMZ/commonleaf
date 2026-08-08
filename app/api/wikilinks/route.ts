import { NextResponse } from 'next/server';

import { handle, readJson, requireString } from '@/lib/api/errors';
import { ensureNote } from '@/lib/notes/repository';

/**
 * Following a link to a note that has not been written yet.
 *
 * Returns the note, creating it first if necessary. This is what turns
 * `[[Marginalia]]` from a dead end into the next thing you write.
 */
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    return NextResponse.json(await ensureNote(requireString(body, 'target')));
  });
}
