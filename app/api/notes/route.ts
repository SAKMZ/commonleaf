import { NextResponse } from 'next/server';

import {
  handle,
  optionalString,
  optionalStringList,
  readJson,
  requireString,
} from '@/lib/api/errors';
import { createNote } from '@/lib/notes/repository';

/** Creating a note. Editing one lives on `/api/notes/[...slug]`. */
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);

    const result = await createNote({
      title: requireString(body, 'title'),
      slug: optionalString(body, 'slug'),
      body: optionalString(body, 'body'),
      folder: optionalString(body, 'folder'),
      tags: optionalStringList(body, 'tags'),
    });

    return NextResponse.json(result, { status: 201 });
  });
}
