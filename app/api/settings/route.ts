import { NextResponse } from 'next/server';

import { handle, readJson } from '@/lib/api/errors';
import { writeStoredSettings } from '@/lib/settings/server-store';
import { normaliseSettings } from '@/lib/settings/types';

/**
 * Recording the reader's preferences in the notebook.
 *
 * There is no `GET`: the root layout reads the file server-side and puts the
 * answer in the HTML, so the browser never has to ask for it. Adding a read
 * endpoint here would be a second way to learn the same thing, and the two
 * would eventually disagree.
 */
export const dynamic = 'force-dynamic';

export function PUT(request: Request) {
  return handle(async () => {
    const body = await readJson(request);

    // Normalised rather than validated: settings from an older or newer
    // version of the application must not be a 400, they must be read for
    // what they are worth. The same function guards `localStorage`.
    const stored = await writeStoredSettings(normaliseSettings(body.settings));

    return NextResponse.json(stored);
  });
}
