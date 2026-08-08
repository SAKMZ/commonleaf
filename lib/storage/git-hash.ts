import { createHash } from 'node:crypto';

/**
 * Computes the Git blob SHA-1 for `content`.
 *
 * Git hashes `blob <byte-length>\0<bytes>` rather than the bytes alone. Being
 * able to derive the same identifier locally means a bulk tree read and a
 * single-file read produce interchangeable SHAs, which is what makes the
 * optimistic-concurrency check in {@link Storage.commit} trustworthy.
 */
export function gitBlobSha(content: string | Uint8Array): string {
  const bytes =
    typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}
