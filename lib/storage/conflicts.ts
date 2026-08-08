import { ConflictError, type Change } from './types';

/**
 * Refuses writes whose base version is stale.
 *
 * This lives beside the port rather than inside a driver because it is part of
 * the contract, not part of any one backend: every `Storage` implementation
 * owes callers the same answer to "someone else changed this file while I was
 * editing it". A driver that skipped it would silently lose a reader's work.
 *
 * `expectedSha` carries three meanings, and all three matter:
 *
 * - a string — the file must currently be exactly that blob;
 * - `null` — the file must not exist, which is how "create" refuses to clobber;
 * - `undefined` — the caller is not making a claim, so overwrite freely.
 */
export function assertNoConflicts(
  changes: readonly Change[],
  existing: ReadonlyMap<string, string>,
): void {
  for (const change of changes) {
    if (change.kind !== 'write' || change.expectedSha === undefined) continue;
    const actual = existing.get(change.path) ?? null;
    if (actual !== change.expectedSha) {
      throw new ConflictError(change.path, change.expectedSha, actual);
    }
  }
}
