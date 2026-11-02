import { defineConfig } from 'vitest/config';

// RNF-3: corre contra el entorno de Docker (nginx en http://localhost:8080, o SHOPCART_URL), nunca contra
// shopcart_test: los datos los crea la propia prueba con la API.
export default defineConfig({
  test: {
    include: ['test/concurrencia/**/*.test.ts'],
    environment: 'node',
    // Un escenario hace unas 100 peticiones (inicio de sesión de 20 clientes, carritos y compra).
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
