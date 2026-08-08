import { NextResponse } from 'next/server';

import { BadRequestError, handle } from '@/lib/api/errors';
import { importNotes } from '@/lib/notes/repository';
import { MAX_IMPORT_BYTES, readVaultArchive } from '@/lib/vault/archive';

/**
 * Bringing a folder of Markdown in.
 *
 * Existing notes are left alone unless `overwrite` says otherwise, because the
 * common mistake is importing the same archive twice and the expensive one is
 * losing work to it.
 */
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      throw new BadRequestError('Choose a .zip archive to import.');
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new BadRequestError(
        `That archive is larger than the ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB limit.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const files = await readVaultArchive(bytes).catch(() => {
      throw new BadRequestError('That file could not be read as a .zip archive.');
    });

    if (files.length === 0) {
      throw new BadRequestError('No Markdown files were found in that archive.');
    }

    const summary = await importNotes(files, {
      overwrite: form?.get('overwrite') === 'true',
    });

    return NextResponse.json(summary);
  });
}
