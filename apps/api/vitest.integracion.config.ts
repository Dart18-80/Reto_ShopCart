import { defineConfig } from 'vitest/config';
import { BASE_REDIS_PRUEBAS } from './test/integracion/redis-de-pruebas.js';

// Condición de exports de @shopcart/shared que apunta a su código fuente (tsconfig.json: customConditions).
const CONDICION_FUENTE = '@shopcart/fuente';
// Pruebas que cambian estado global de la base (por ejemplo, cuántos Admins activos hay): corren solas.
const SECUENCIALES = 'test/integracion/secuencial/**/*.test.ts';

export default defineConfig({
  // @shopcart/shared se usa desde src/ en desarrollo: las pruebas no exigen compilarlo antes.
  resolve: { conditions: [CONDICION_FUENTE] },
  ssr: { resolve: { conditions: [CONDICION_FUENTE] } },
  test: {
    environment: 'node',
    // Todas las pruebas en paralelo comparten una sola base: un flujo de varias peticiones seguidas puede
    // pasar de los 5 s por defecto sin que nada esté bloqueado.
    testTimeout: 15_000,
    // Las pruebas de integración nunca tocan la base real: siempre shopcart_test y su propia base de Redis.
    env: { DB_NOMBRE: 'shopcart_test', REDIS_BASE_DATOS: String(BASE_REDIS_PRUEBAS) },
    globalSetup: ['test/integracion/redis-de-pruebas.ts'],
    setupFiles: ['test/integracion/cargar-entorno.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'paralelo',
          include: ['test/integracion/**/*.test.ts'],
          exclude: [SECUENCIALES],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'secuencial',
          include: [SECUENCIALES],
          // Empieza cuando termina todo el grupo paralelo y corre un archivo a la vez.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
