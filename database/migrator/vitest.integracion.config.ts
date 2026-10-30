import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integracion/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/integracion/cargar-entorno.ts'],
    // Todas las pruebas recrean y migran la misma base shopcart_test: una a la vez.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 120_000,
  },
});
