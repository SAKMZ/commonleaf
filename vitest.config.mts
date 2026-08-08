import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Resolves the `@/*` aliases from tsconfig.json natively, so the path
  // mapping is declared once.
  resolve: { tsconfigPaths: true },
  test: {
    // Most of the codebase is plain TypeScript that runs on the server. Only
    // component tests need a DOM, and they ask for one with a file-level
    // `@vitest-environment jsdom` comment.
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'hooks/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
