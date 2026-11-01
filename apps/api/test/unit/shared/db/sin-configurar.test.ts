import { describe, expect, it } from 'vitest';
import { ejecutarSP, ejecutarSPConjuntos } from '../../../../src/shared/db/index.js';

// Cada archivo de prueba corre en su propio módulo: aquí nadie llamó a configurarBaseDatos.
describe('ejecutarSP sin configurar la base', () => {
  it('falla con un mensaje que dice qué falta, en lugar de un TypeError', async () => {
    await expect(ejecutarSP('SP_Sistema_Health')).rejects.toThrow(/configurarBaseDatos/);
  });

  it('ejecutarSPConjuntos falla igual', async () => {
    await expect(ejecutarSPConjuntos('SP_Sistema_Health')).rejects.toThrow(/configurarBaseDatos/);
  });
});
