import { NextResponse } from 'next/server';

import { ConfigurationError } from '../config';
import { NoteExistsError, NoteNotFoundError } from '../notes/repository';
import { ConflictError, StorageError } from '../storage/types';

/**
 * One place that decides what an error looks like over HTTP.
 *
 * Route handlers stay short because they never write a status code by hand,
 * and — more importantly — the browser always receives the same shape, so the
 * editor can react to a save conflict without parsing prose.
 */

export interface ApiError {
  /** A stable string the client can branch on. */
  code: string;
  /** Written for the reader, not for a log. */
  message: string;
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json<ApiError>({ code, message }, { status });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ConflictError) {
    return apiError('conflict', error.message, 409);
  }
  if (error instanceof NoteExistsError) {
    return apiError('exists', error.message, 409);
  }
  if (error instanceof NoteNotFoundError) {
    return apiError('not_found', error.message, 404);
  }
  if (error instanceof ConfigurationError) {
    return apiError('not_configured', error.message, 503);
  }
  if (error instanceof StorageError) {
    return apiError('storage', error.message, error.status ?? 502);
  }

  // Anything unrecognised is a bug. Say so plainly rather than inventing a
  // reassuring message, and keep the details out of the response body.
  console.error('Unhandled API error', error);
  return apiError('unexpected', 'Something went wrong. The change was not saved.', 500);
}

/** Raised by the readers below; carries its own HTTP response. */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Minimal request-body reading.
 *
 * A validation library would be more expressive, but these payloads have a
 * handful of fields between them and the checks are one line each. That is not
 * enough to justify a dependency the whole project then depends on.
 */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestError('Expected a JSON object.');
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('Could not read the request body as JSON.');
  }
}

export function requireString(
  body: Record<string, unknown>,
  field: string,
  { allowEmpty = false } = {},
): string {
  const value = body[field];
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new BadRequestError(`"${field}" is required.`);
  }
  return value;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field];
  return typeof value === 'string' ? value : undefined;
}

export function optionalStringList(
  body: Record<string, unknown>,
  field: string,
): string[] | undefined {
  const value = body[field];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Reads the base version an edit was made against.
 *
 * The three states are meaningfully different: a SHA means "I loaded this
 * version", `null` means "I believe this note does not exist", and `undefined`
 * means no check was requested. Collapsing them would quietly disable conflict
 * detection.
 */
export function readExpectedSha(body: Record<string, unknown>): string | null | undefined {
  if (!('expectedSha' in body)) return undefined;
  const value = body.expectedSha;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new BadRequestError('"expectedSha" must be a string or null.');
}

/** Wraps a handler so domain errors become responses. */
export async function handle(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof BadRequestError) {
      return apiError('bad_request', error.message, 400);
    }
    return toErrorResponse(error);
  }
}
