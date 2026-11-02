import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rangoDeFechasSchema } from '../../../../src/shared/http/index.js';

const consulta = rangoDeFechasSchema.safeExtend({ estado: z.enum(['A', 'B']).optional() });

describe('rango de fechas compartido (A-12)', () => {
  it('acepta el rango completo, uno solo de sus extremos o ninguno, junto con los campos propios', () => {
    const resultados = [
      { desde: '2026-11-01', hasta: '2026-11-02', estado: 'A' },
      { desde: '2026-11-02', hasta: '2026-11-02' },
      { desde: '2026-11-01' },
      { hasta: '2026-11-01' },
      {},
    ].map((entrada) => consulta.safeParse(entrada).success);

    expect(resultados).toEqual([true, true, true, true, true]);
  });

  it('rechaza un rango al revés con el error en desde', () => {
    const resultado = consulta.safeParse({ desde: '2026-11-02', hasta: '2026-11-01' });

    expect(resultado.error?.issues).toEqual([
      expect.objectContaining({
        path: ['desde'],
        message: 'La fecha inicial no puede ser posterior a la final.',
      }) as unknown,
    ]);
  });

  it('rechaza una fecha que no es ISO', () => {
    expect(consulta.safeParse({ desde: '02/11/2026' }).success).toBe(false);
  });
});
