import { NextResponse } from 'next/server';

import { apiError, handle } from '@/lib/api/errors';
import { saveImage } from '@/lib/notes/repository';

/**
 * Receiving a pasted or dropped image.
 *
 * Uploads are limited by type and size before anything is committed: a Git
 * repository keeps every version of every file forever, so an accidental
 * hundred-megabyte drop is not something you can quietly undo later.
 */
export const dynamic = 'force-dynamic';

const ACCEPTED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/svg+xml', '.svg'],
]);

/** Ten megabytes. Generous for a screenshot, small enough to stay sane in Git. */
const MAX_BYTES = 10 * 1024 * 1024;

export function POST(request: Request) {
  return handle(async () => {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!(file instanceof File)) {
      return apiError('bad_request', 'Expected a file field named "file".', 400);
    }

    const extension = ACCEPTED.get(file.type);
    if (!extension) {
      return apiError(
        'unsupported_type',
        `${file.type || 'That file type'} cannot be stored. Use PNG, JPEG, GIF, WebP, AVIF or SVG.`,
        415,
      );
    }

    if (file.size > MAX_BYTES) {
      return apiError(
        'too_large',
        `Images must be under ${MAX_BYTES / 1024 / 1024} MB. This one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        413,
      );
    }

    // A name is not guaranteed — a pasted screenshot often has none — so fall
    // back to something the extension can be attached to.
    const name = file.name && file.name !== 'blob' ? file.name : `pasted${extension}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    return NextResponse.json(await saveImage(name, bytes), { status: 201 });
  });
}
