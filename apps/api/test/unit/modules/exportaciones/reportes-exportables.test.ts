import { describe, expect, it } from 'vitest';
import { REPORTES_EXPORTABLES } from '../../../../src/modules/exportaciones/exportaciones.types.js';
import { REPORTES } from '../../../../src/modules/reportes/index.js';

describe('reportes exportables (E7-H05, RF-08)', () => {
  it('son la misma lista que la de reportes: un reporte nuevo se agrega en un solo lugar', () => {
    expect(REPORTES_EXPORTABLES).toBe(REPORTES);
  });
});
