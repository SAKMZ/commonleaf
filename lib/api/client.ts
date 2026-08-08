import type { SearchDocument } from '../search/documents';
import type { ImportSummary } from '../vault/types';
import type { ApiError } from './errors';

/**
 * The browser's side of the API.
 *
 * Every call goes through `request`, so error handling is written once and
 * components never touch `fetch`. Errors arrive as {@link RequestError} with
 * the server's `code` intact, which is what lets the editor tell a save
 * conflict apart from a network failure without reading prose.
 */

export class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }

  /** Someone else changed the note since it was opened. */
  get isConflict(): boolean {
    return this.code === 'conflict';
  }
}

const mutationListeners = new Set<() => void>();

/**
 * Called after any request that may have changed the notebook.
 *
 * Caches held in the browser — the search index, today — need to know when
 * what they describe has moved on. Announcing it from here means a future
 * writer cannot forget to: every write already goes through `request`.
 */
export function onMutation(listener: () => void): () => void {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new RequestError(
      'offline',
      'Could not reach the server. Your changes are still here — try saving again.',
      0,
    );
  }

  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload as ApiError | null;
    throw new RequestError(
      error?.code ?? 'unexpected',
      error?.message ?? `The request failed (${response.status}).`,
      response.status,
    );
  }

  if ((init.method ?? 'GET').toUpperCase() !== 'GET') {
    for (const listener of mutationListeners) listener();
  }

  return payload as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface SaveResult {
  slug: string;
  path: string;
  sha: string;
  commit: string | null;
}

export interface RawNote {
  slug: string;
  path: string;
  sha: string;
  title: string;
  body: string;
}

/** Only the fields present are changed; the rest of the frontmatter is kept. */
export interface SaveNotePayload {
  body: string;
  expectedSha: string | null | undefined;
  title?: string;
  tags?: string[];
  favorite?: boolean;
}

function notePath(slug: string): string {
  return `/api/notes/${slug.split('/').map(encodeURIComponent).join('/')}`;
}

export const api = {
  readNote: (slug: string) => request<RawNote>(notePath(slug)),

  /** Every note, reduced to what the palette needs to rank them. */
  searchIndex: () => request<{ documents: SearchDocument[] }>('/api/search'),

  /**
   * `expectedSha` is the version the editor loaded. Passing it is what makes
   * the save fail rather than silently overwrite a newer edit.
   */
  saveNote: (slug: string, payload: SaveNotePayload) =>
    request<SaveResult>(notePath(slug), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  createNote: (input: { title: string; slug?: string; body?: string; folder?: string }) =>
    postJson<SaveResult>('/api/notes', input),

  moveNote: (slug: string, to: string) =>
    request<SaveResult>(notePath(slug), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    }),

  deleteNote: (slug: string, title?: string) =>
    request<void>(`${notePath(slug)}${title ? `?title=${encodeURIComponent(title)}` : ''}`, {
      method: 'DELETE',
    }),

  ensureWikiLink: (target: string) => postJson<SaveResult>('/api/wikilinks', { target }),

  ensureDailyNote: (date: string) => postJson<SaveResult>('/api/daily', { date }),

  uploadImage: async (file: File): Promise<{ path: string; markdownPath: string }> => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/images', { method: 'POST', body: form });
  },

  importVault: async (file: File, overwrite: boolean): Promise<ImportSummary> => {
    const form = new FormData();
    form.append('file', file);
    form.append('overwrite', String(overwrite));
    return request('/api/import', { method: 'POST', body: form });
  },
};
