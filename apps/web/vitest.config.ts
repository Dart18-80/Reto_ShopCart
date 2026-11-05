import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config.js';

// Pruebas que leen archivos, corren ESLint o construyen la web: no usan el DOM ni la API simulada.
const PRUEBAS_DE_NODE = [
  'src/app/tema.test.ts',
  'src/app/paquetes.test.ts',
  'src/test/accesibilidad-lint.test.ts',
  'src/test/fronteras.test.ts',
];
const LIMITE_PRUEBAS_DE_NODE_MS = 120_000;

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
        {
          extends: true,
          test: {
            name: 'node',
            include: PRUEBAS_DE_NODE,
            environment: 'node',
            // Las que levantan ESLint (con el resolver de TypeScript) o construyen la web son lentas y se pelean por
            // la CPU: en paralelo con las del DOM, bajo `pnpm test`, se agotaba una de ellas (60 s) o una del DOM (5 s).
            // Corren después de todo el DOM (grupo 1), una a la vez y con un límite propio: cada una tiene la
            // máquina para sí y el límite solo cae ante un cuelgue real.
            sequence: { groupOrder: 1 },
            fileParallelism: false,
            testTimeout: LIMITE_PRUEBAS_DE_NODE_MS,
            hookTimeout: LIMITE_PRUEBAS_DE_NODE_MS,
          },
        },
      ],
    },
  }),
);
