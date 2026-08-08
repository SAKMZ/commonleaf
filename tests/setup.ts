import '@testing-library/jest-dom/vitest';

import { afterEach, vi } from 'vitest';

/**
 * `server-only` throws when imported outside a React Server Component, which
 * is exactly what a Vitest run is. Stubbing it lets the storage and config
 * modules be tested directly while the guard still protects real builds.
 */
vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
