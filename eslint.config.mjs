import js from '@eslint/js';
import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'coverage/**', 'next-env.d.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  {
    rules: {
      // Unused arguments are common in React event handlers and adapters;
      // an underscore prefix is the agreed way to say "intentionally unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` erases the guarantees the rest of the codebase relies on.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  {
    // Tests report failures; command-line scripts report progress. Printing is
    // the point in both, and `no-console` exists to keep it out of the app.
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*', 'scripts/**/*'],
    rules: { 'no-console': 'off' },
  },

  // Must stay last: switches off stylistic rules Prettier already owns.
  prettier,
);
