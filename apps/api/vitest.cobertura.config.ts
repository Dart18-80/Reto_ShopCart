import { defineConfig, mergeConfig } from 'vitest/config';
import integracion from './vitest.integracion.config.js';

// Decisión del PO (cierre de la Fase 1): un solo reporte de cobertura con las unitarias y las de integración en
// la misma corrida, sin fusionar reportes aparte. Los proyectos de integración se reutilizan tal cual (base
// shopcart_test ya migrada: `pnpm test:cobertura` lo hace antes) y las unitarias se suman con su configuración.
export default mergeConfig(
  integracion,
  defineConfig({
    test: {
      projects: [{ extends: './vitest.config.ts', test: { name: 'unitarias' } }],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        reporter: ['text-summary', 'html', 'json-summary'],
        reportsDirectory: 'coverage/combinada',
      },
    },
  }),
);
