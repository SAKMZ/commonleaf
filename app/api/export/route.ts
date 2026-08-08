import { NextResponse } from 'next/server';

import { handle } from '@/lib/api/errors';
import { getNotes } from '@/lib/notes/store';
import { archiveFileName, buildVaultArchive, buildVaultJson } from '@/lib/vault/archive';

/**
 * Taking the notebook away.
 *
 * The ZIP is the real export — it is the vault, unchanged, and every other
 * Markdown tool can open it. The JSON is for feeding the notes into something
 * that would rather not parse frontmatter itself.
 */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handle(async () => {
    const format = new URL(request.url).searchParams.get('format') ?? 'zip';

    if (format === 'json') {
      const collection = await getNotes();

      return NextResponse.json(buildVaultJson(collection), {
        headers: {
          'Content-Disposition': `attachment; filename="commonleaf-${new Date()
            .toISOString()
            .slice(0, 10)}.json"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const archive = await buildVaultArchive();

    return new NextResponse(archive as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveFileName()}"`,
        'Content-Length': String(archive.byteLength),
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
