import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config.js';

// Pruebas que leen archivos o corren ESLint: no usan el DOM ni la API simulada, y no cargan la aplicación.
const PRUEBAS_DE_NODE = [
  'src/app/tema.test.ts',
  'src/test/accesibilidad-lint.test.ts',
  'src/test/fronteras.test.ts',
];

export default mergeConfig(
  vite,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'dom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: PRUEBAS_DE_NODE,
            environment: 'jsdom',
            // El navegador simulado no está en Guatemala: una fecha que no fije America/Guatemala se nota (FE-10).
            env: { TZ: 'UTC' },
            setupFiles: ['src/test/configuracion.ts'],
          },
        },
        { extends: true, test: { name: 'node', include: PRUEBAS_DE_NODE, environment: 'node' } },
      ],
    },
  }),
);
