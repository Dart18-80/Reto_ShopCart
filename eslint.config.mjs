import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', 'docs/']),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // A-01: un módulo solo puede usar a otro a través de su index.ts (su API pública).
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['apps/api/src/**/*.ts'],
      'boundaries/elements': [
        { type: 'modulo', pattern: 'apps/api/src/modules/*', capture: ['modulo'] },
        { type: 'shared', pattern: 'apps/api/src/shared/*', capture: ['pieza'] },
      ],
      'import/resolver': {
        typescript: { project: 'apps/api/tsconfig.json' },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'modulo' } },
              disallow: {
                to: {
                  element: {
                    type: 'modulo',
                    captured: { modulo: '!{{from.captured.modulo}}' },
                    fileInternalPath: '!index.ts',
                  },
                },
              },
              message:
                'A-01: un módulo solo importa el index.ts de otro módulo, nunca sus archivos internos.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
