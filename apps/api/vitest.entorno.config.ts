import { defineConfig } from 'vitest/config';

// Verificación de entrega: respuestas reales del entorno de Docker a través de nginx (http://localhost:8080, o
// SHOPCART_URL). Una prueba pausa SQL Server unos segundos: los archivos corren uno a la vez.
export default defineConfig({
  test: {
    include: ['test/entorno/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
