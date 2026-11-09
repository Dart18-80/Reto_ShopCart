import { defineConfig, devices } from '@playwright/test';

// FE-12: E2E contra el entorno real (`docker compose up -d`), a través de nginx; no levanta nada por su cuenta.
const URL_TIENDA = process.env.SHOPCART_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/preparacion-global.ts',
  // Sin reintentos: una prueba que falla a veces es un error que hay que ver, no esconder.
  retries: 0,
  // Contra el entorno real recién levantado, la primera ejecución de cada SP compila su plan (el migrador reaplica
  // los R__ y la caché de planes se vacía): con cuatro navegadores en la misma máquina, una búsqueda puede tardar
  // más de los 5 s por omisión aunque en caliente responda en 0.25 s. Medido con sys.dm_exec_procedure_stats.
  expect: { timeout: 10_000 },
  // El plazo total de cada prueba (30 s por omisión). Las que abren un segundo contexto (el Admin junto al
  // comprador) pagan al cerrarlo la escritura de su traza: bajo la carga de un entorno recién construido se midió
  // 15 s solo en ese cierre (backoffice-cupones, 9 nov). Las aserciones siguen con sus 10 s.
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: URL_TIENDA,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(checkout|pedidos)\.spec\.ts/,
    },
    // El checkout y los pedidos usan los carritos de los dos clientes de la corrida, que otras pruebas también
    // usan: corren después, cada archivo en su proyecto para que no corran a la vez entre ellos.
    // Para correr uno solo: `pnpm test:e2e --project checkout --no-deps`.
    {
      name: 'checkout',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /checkout\.spec\.ts/,
      dependencies: ['chromium'],
    },
    {
      name: 'pedidos',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /pedidos\.spec\.ts/,
      dependencies: ['checkout'],
    },
  ],
});
