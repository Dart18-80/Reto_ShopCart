import { describe, expect, it } from 'vitest';
import { ejecutarSP, ejecutarSPMultiple } from '../../../../src/shared/db/index.js';

// Cada archivo de prueba corre en su propio módulo: aquí nadie llamó a configurarBaseDatos.
describe('ejecutarSP sin configurar la base', () => {
  it('falla con un mensaje que dice qué falta, en lugar de un TypeError', async () => {
    await expect(ejecutarSP('SP_Sistema_Health')).rejects.toThrow(/configurarBaseDatos/);
  });

  it('ejecutarSPMultiple falla igual', async () => {
    await expect(ejecutarSPMultiple('SP_Sistema_Health')).rejects.toThrow(/configurarBaseDatos/);
  });
});
