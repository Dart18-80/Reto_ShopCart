import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    'docs/',
    // FE-13: tipos generados por pnpm openapi:exportar.
    'packages/contrato/src/openapi.ts',
  ]),
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
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
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // FE-09: paginas → componentes → hooks → <modulo>.api.ts → shared/api; entre módulos, solo por index.ts.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': import.meta.dirname,
      'boundaries/include': ['apps/web/src/**/*.{ts,tsx}'],
      'boundaries/elements': [
        { type: 'web-app', pattern: 'apps/web/src/app' },
        { type: 'web-modulo', pattern: 'apps/web/src/modules/*', capture: ['modulo'] },
        { type: 'web-shared', pattern: 'apps/web/src/shared/*', capture: ['pieza'] },
      ],
      'boundaries/files': [
        { category: 'pagina', pattern: 'apps/web/src/modules/*/paginas/**' },
        {
          category: 'componente',
          pattern: [
            'apps/web/src/modules/*/componentes/**',
            'apps/web/src/shared/componentes/**',
            'apps/web/src/shared/ui/**',
          ],
        },
        {
          category: 'hook',
          pattern: ['apps/web/src/modules/*/hooks/**', 'apps/web/src/shared/hooks/**'],
        },
        { category: 'api-modulo', pattern: 'apps/web/src/modules/*/*.api.ts' },
        { category: 'cliente-api', pattern: 'apps/web/src/shared/api/**' },
      ],
      'import/resolver': {
        typescript: { project: 'apps/web/tsconfig.json' },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          checkInternals: true,
          policies: [
            {
              from: { element: { type: 'web-modulo' } },
              disallow: {
                to: {
                  element: {
                    type: 'web-modulo',
                    captured: { modulo: '!{{from.captured.modulo}}' },
                    fileInternalPath: '!index.ts',
                  },
                },
              },
              message: 'FE-09: un módulo solo importa el index.ts de otro módulo.',
            },
            {
              // La única excepción: el router importa las páginas con lazy() para la carga diferida.
              from: { element: { type: 'web-app' } },
              disallow: {
                to: {
                  element: { type: 'web-modulo', fileInternalPath: '!{index.ts,paginas/**}' },
                },
              },
              message: 'FE-09: app/ solo importa el index.ts o las páginas de un módulo.',
            },
            {
              from: { element: { type: 'web-shared' } },
              disallow: { to: { element: { type: 'web-modulo' } } },
              message: 'FE-09: shared/ no conoce los módulos.',
            },
            {
              // Decisión del PO (F1-H01): una página o un componente puede importar solo tipos de shared/api
              // (`import type { ErrorApi }`, para mostrar un error), nunca código: llamar a la API es de los hooks.
              from: { file: { categories: { anyOf: ['pagina', 'componente'] } } },
              disallow: { to: { file: { categories: { anyOf: ['cliente-api', 'api-modulo'] } } } },
              dependency: { kind: 'value' },
              message:
                'FE-09: una página o un componente nunca llama a la API; usa un hook del módulo.',
            },
            {
              from: { file: { categories: 'componente' } },
              disallow: { to: { file: { categories: 'pagina' } } },
              message: 'FE-09: un componente no importa páginas.',
            },
            {
              from: { file: { categories: 'hook' } },
              disallow: { to: { file: { categories: { anyOf: ['pagina', 'componente'] } } } },
              message: 'FE-09: un hook no importa componentes ni páginas.',
            },
            {
              from: { file: { categories: 'api-modulo' } },
              disallow: {
                to: { file: { categories: { anyOf: ['pagina', 'componente', 'hook'] } } },
              },
              message: 'FE-09: el archivo .api.ts solo usa el cliente api, sin React.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
