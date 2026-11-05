import { defineConfig, devices } from '@playwright/test';

// FE-12: E2E contra el entorno real (`docker compose up -d`), a través de nginx; no levanta nada por su cuenta.
const URL_TIENDA = process.env.SHOPCART_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/preparacion-global.ts',
  // Sin reintentos: una prueba que falla a veces es un error que hay que ver, no esconder.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: URL_TIENDA,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /checkout\.spec\.ts/ },
    // El checkout usa los carritos de los dos clientes de la corrida, que otras pruebas también usan: corre después.
    // Para correrlo solo: `pnpm test:e2e --project checkout --no-deps`.
    {
      name: 'checkout',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /checkout\.spec\.ts/,
      dependencies: ['chromium'],
    },
  ],
});
