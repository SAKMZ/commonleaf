import type { NoteCollection } from './collection';
import { getNotes } from './store';

/**
 * Reads the notebook without throwing.
 *
 * A first run with no `.env.local` is the most likely way anyone meets this
 * application, and a stack trace is a poor introduction. Pages ask for the
 * notebook this way so they can show the setup instructions instead — which is
 * a normal outcome here, not an exception.
 */
export type NotebookResult =
  | { readonly ok: true; readonly collection: NoteCollection }
  | { readonly ok: false; readonly error: unknown };

export async function loadNotes(): Promise<NotebookResult> {
  try {
    return { ok: true, collection: await getNotes() };
  } catch (error) {
    return { ok: false, error };
  }
}
