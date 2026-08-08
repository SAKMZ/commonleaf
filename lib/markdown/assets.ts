/**
 * Turning an image reference in a note into a URL the browser can fetch.
 *
 * Notes must stay portable, so what is written in the file is a plain relative
 * path — the same thing any other Markdown editor would understand. Mapping it
 * onto the media route happens at render time and is never written back.
 */

/** Serves a file from the vault. Kept here so the route and the renderer agree. */
export const MEDIA_ROUTE = '/api/media';

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function isExternalUrl(src: string): boolean {
  return ABSOLUTE.test(src);
}

/**
 * Resolves `src` against the folder of the note that referenced it.
 *
 * A leading `/` means "from the top of the content directory" rather than the
 * web root, because inside a vault that is the only root there is.
 */
export function resolveAssetPath(src: string, noteFolder: string): string | null {
  const trimmed = src.trim();
  if (trimmed === '') return null;

  const base = trimmed.startsWith('/') ? [] : noteFolder.split('/').filter(Boolean);
  const segments = trimmed.replace(/^\//, '').split('/');
  const resolved: string[] = [...base];

  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      // Refusing to climb above the content directory keeps a note from
      // reaching into the rest of the repository.
      if (resolved.length === 0) return null;
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.length === 0 ? null : resolved.join('/');
}

/** The URL to render an image reference as, or `null` if it cannot be resolved. */
export function assetUrl(src: string, noteFolder: string): string | null {
  if (isExternalUrl(src)) return src;

  const path = resolveAssetPath(src, noteFolder);
  if (!path) return null;

  return `${MEDIA_ROUTE}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
