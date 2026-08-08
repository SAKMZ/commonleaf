import { NextResponse } from 'next/server';

import {
  apiError,
  handle,
  optionalString,
  optionalStringList,
  readExpectedSha,
  readJson,
  requireString,
} from '@/lib/api/errors';
import { normaliseTag } from '@/lib/notes/frontmatter';
import { normaliseSlug } from '@/lib/notes/paths';
import { deleteNote, moveNote, readRaw, saveNote } from '@/lib/notes/repository';

/**
 * One note.
 *
 * `GET` returns the raw Markdown the editor loads, together with the blob SHA
 * that a later `PUT` sends back — that round trip is what lets a save refuse to
 * overwrite a change someone made elsewhere.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string[] }> };

async function slugFrom({ params }: Params): Promise<string | null> {
  const { slug } = await params;
  return normaliseSlug(slug.join('/'));
}

export function GET(_request: Request, context: Params) {
  return handle(async () => {
    const slug = await slugFrom(context);
    if (!slug) return apiError('bad_request', 'Invalid note path.', 400);

    const note = await readRaw(slug);
    if (!note) return apiError('not_found', `No note at "${slug}".`, 404);

    return NextResponse.json({
      slug,
      path: note.path,
      sha: note.sha,
      title: note.frontmatter.title,
      frontmatter: note.frontmatter,
      body: note.body,
    });
  });
}

/**
 * Saving.
 *
 * The client sends prose, not a file. Frontmatter is merged here from what is
 * already on disk, so the editor never has to show the reader a block of YAML
 * and a field added by a future version is not wiped out by an older client.
 * Only the fields actually present in the request are changed.
 */
export function PUT(request: Request, context: Params) {
  return handle(async () => {
    const slug = await slugFrom(context);
    if (!slug) return apiError('bad_request', 'Invalid note path.', 400);

    const payload = await readJson(request);
    const markdown = requireString(payload, 'body', { allowEmpty: true });

    const existing = await readRaw(slug);
    if (!existing) return apiError('not_found', `No note at "${slug}".`, 404);

    const title = optionalString(payload, 'title');
    const tags = optionalStringList(payload, 'tags');
    const favorite = payload.favorite;

    const result = await saveNote({
      slug,
      frontmatter: {
        ...existing.frontmatter,
        title: title?.trim() || existing.frontmatter.title,
        tags: tags ? tags.map(normaliseTag).filter(Boolean) : existing.frontmatter.tags,
        favorite: typeof favorite === 'boolean' ? favorite : existing.frontmatter.favorite,
      },
      body: markdown,
      expectedSha: readExpectedSha(payload),
    });

    return NextResponse.json(result);
  });
}

/** Moving or renaming: `{ "to": "books/new-name" }`. */
export function PATCH(request: Request, context: Params) {
  return handle(async () => {
    const slug = await slugFrom(context);
    if (!slug) return apiError('bad_request', 'Invalid note path.', 400);

    const body = await readJson(request);
    return NextResponse.json(await moveNote(slug, requireString(body, 'to')));
  });
}

export function DELETE(request: Request, context: Params) {
  return handle(async () => {
    const slug = await slugFrom(context);
    if (!slug) return apiError('bad_request', 'Invalid note path.', 400);

    // The title is only used for the commit message, so a missing one is fine.
    const title = new URL(request.url).searchParams.get('title') ?? undefined;
    await deleteNote(slug, title);

    return new NextResponse(null, { status: 204 });
  });
}
