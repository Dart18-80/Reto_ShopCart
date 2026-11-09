import { describe, expect, it } from 'vitest';
import { reportesDelDominio } from './reportes.keys';

describe('reportesDelDominio (FE-11)', () => {
  it('un aviso de ventas vuelve a pedir el resumen y los reportes de ventas', () => {
    expect(reportesDelDominio('ventas')).toEqual([
      'resumen',
      'ventas',
      'ventas-por-categoria',
      'top-productos',
    ]);
  });

  it('un aviso de carritos vuelve a pedir el resumen (cuenta los abandonados) y los carritos', () => {
    expect(reportesDelDominio('carritos')).toEqual(['resumen', 'carritos-abandonados']);
  });
});
