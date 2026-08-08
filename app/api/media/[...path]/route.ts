import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { normaliseSlug } from '@/lib/notes/paths';
import { getStorage } from '@/lib/storage';
import { StorageError } from '@/lib/storage/types';

/**
 * Serves images and attachments out of the vault.
 *
 * The repository is private, so files cannot be linked to directly — the token
 * that can read them must never leave the server. This route is the only way
 * in, and it is read-only.
 */

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function contentTypeFor(path: string): string | null {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = normaliseSlug(segments.join('/'));

  if (!relative) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  }

  // An allowlist rather than a guess: serving an arbitrary file from the vault
  // with a sniffed type is how a Markdown note becomes a script tag.
  const contentType = contentTypeFor(relative);
  if (!contentType) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
  }

  const { contentDirectory } = getConfig();

  try {
    const file = await getStorage().readBinary(
      contentDirectory === '' ? relative : `${contentDirectory}/${relative}`,
    );

    if (!file) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.bytes.byteLength),
        // The blob SHA changes whenever the bytes do, so a conditional request
        // can be answered without reading the file again.
        ETag: `"${file.sha}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
        // SVGs are rendered in an <img>, which cannot run scripts, but a direct
        // visit would open one as a document. This closes that door.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    const status = error instanceof StorageError ? (error.status ?? 502) : 500;
    return NextResponse.json({ error: 'Could not read the file.' }, { status });
  }
}
