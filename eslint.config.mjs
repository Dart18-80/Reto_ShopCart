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
      // Los patrones son relativos a la raíz del repositorio, no al directorio desde el que corre ESLint:
      // sin esto, el lint lanzado desde apps/api (editor, Vitest) no aplicaba la regla.
      'boundaries/root-path': import.meta.dirname,
      'boundaries/include': ['apps/api/src/**/*.ts'],
      'boundaries/elements': [
        { type: 'modulo', pattern: 'apps/api/src/modules/*', capture: ['modulo'] },
        { type: 'shared', pattern: 'apps/api/src/shared/*', capture: ['pieza'] },
      ],
      // Decisión del PO (E9): la capa de cada archivo de un módulo, por su sufijo.
      'boundaries/files': [
        { category: 'rutas', pattern: 'apps/api/src/modules/*/*.routes.ts' },
        { category: 'controlador', pattern: 'apps/api/src/modules/*/*.controller.ts' },
        { category: 'servicio', pattern: 'apps/api/src/modules/*/*.service.ts' },
        { category: 'repositorio', pattern: 'apps/api/src/modules/*/*.repository.ts' },
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
          // Las capas se importan dentro de un mismo módulo (dependencias internas) y Express es externo: sin esto,
          // la regla solo revisaría lo que cruza entre módulos.
          checkInternals: true,
          checkAllOrigins: true,
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
            // A-01, orden de capas dentro de un módulo: routes → controller → service → repository.
            {
              from: { file: { categories: 'controlador' } },
              disallow: { to: { file: { categories: 'repositorio' } } },
              message: 'A-01 (capas): el controlador llama al servicio, nunca al repositorio.',
            },
            {
              from: { file: { categories: 'servicio' } },
              disallow: { to: { file: { categories: { anyOf: ['rutas', 'controlador'] } } } },
              message: 'A-01 (capas): el servicio no conoce las rutas ni el controlador.',
            },
            {
              from: { file: { categories: 'servicio' } },
              disallow: { to: { module: { origin: 'external', source: 'express' } } },
              message:
                'A-01 (capas): el servicio no depende de Express; recibe sus datos ya validados.',
            },
            {
              from: { file: { categories: 'repositorio' } },
              disallow: { to: { file: { categories: 'servicio' } } },
              message: 'A-01 (capas): el repositorio no llama al servicio.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
