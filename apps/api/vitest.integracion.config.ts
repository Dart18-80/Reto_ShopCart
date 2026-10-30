import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integracion/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de integración nunca tocan la base real: siempre shopcart_test.
    env: { DB_NOMBRE: 'shopcart_test' },
    setupFiles: ['test/integracion/cargar-entorno.ts'],
  },
});
