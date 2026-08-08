/**
 * What an import did.
 *
 * In its own module — with no `server-only` import and no dependencies —
 * because both the route that produces it and the browser that displays it
 * need the shape, and neither should have to reach into the other's world for
 * it.
 */
export interface ImportSummary {
  readonly added: number;
  readonly replaced: number;
  readonly skipped: number;
  /** Paths that could not be used, for reporting back. */
  readonly rejected: readonly string[];
}
