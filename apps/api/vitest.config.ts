import { defineConfig } from 'vitest/config';

// Condición de exports de @shopcart/shared que apunta a su código fuente (tsconfig.json: customConditions).
const CONDICION_FUENTE = '@shopcart/fuente';

export default defineConfig({
  // @shopcart/shared se usa desde src/ en desarrollo: las pruebas no exigen compilarlo antes.
  resolve: { conditions: [CONDICION_FUENTE] },
  ssr: { resolve: { conditions: [CONDICION_FUENTE] } },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/**/*.ts'], reporter: ['text', 'html'] },
  },
});
