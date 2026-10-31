import { defineConfig } from 'vitest/config';

// Condición de exports de @shopcart/shared que apunta a su código fuente (tsconfig.json: customConditions).
const CONDICION_FUENTE = '@shopcart/fuente';

export default defineConfig({
  // @shopcart/shared se usa desde src/ en desarrollo: las pruebas no exigen compilarlo antes.
  resolve: { conditions: [CONDICION_FUENTE] },
  ssr: { resolve: { conditions: [CONDICION_FUENTE] } },
  test: {
    include: ['test/integracion/**/*.test.ts'],
    environment: 'node',
    // Las pruebas de integración nunca tocan la base real: siempre shopcart_test.
    env: { DB_NOMBRE: 'shopcart_test' },
    setupFiles: ['test/integracion/cargar-entorno.ts'],
  },
});
