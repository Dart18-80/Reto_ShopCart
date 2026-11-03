import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config.js';

export default mergeConfig(
  vite,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['src/test/configuracion.ts'],
    },
  }),
);
