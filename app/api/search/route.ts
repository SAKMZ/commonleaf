import { NextResponse } from 'next/server';

import { handle } from '@/lib/api/errors';
import { getNotes } from '@/lib/notes/store';
import { buildSearchDocuments } from '@/lib/search/documents';

/**
 * The search index.
 *
 * Ranking happens in the browser rather than here: the whole index is small,
 * the notebook belongs to one person, and a local index means results appear
 * between keystrokes instead of a round trip later. This endpoint exists only
 * to hand over the documents once per session.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return handle(async () => {
    const collection = await getNotes();

    return NextResponse.json(
      { documents: buildSearchDocuments(collection) },
      // Private by definition; a shared cache must never keep a copy.
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  });
}
