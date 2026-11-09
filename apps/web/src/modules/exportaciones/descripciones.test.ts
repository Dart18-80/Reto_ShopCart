import { describe, expect, it } from 'vitest';
import { describirFiltros } from './descripciones';

describe('describirFiltros (M11-H03)', () => {
  it('el rango con sus días; en las ventas, también la agrupación', () => {
    expect(describirFiltros('resumen', { desde: '2026-11-01', hasta: '2026-11-08' })).toBe(
      'Del 1 nov 2026 al 8 nov 2026',
    );
    expect(
      describirFiltros('ventas', {
        desde: '2026-11-01',
        hasta: '2026-11-08',
        agrupacion: 'semana',
      }),
    ).toBe('Del 1 nov 2026 al 8 nov 2026 · por semana');
  });

  it('sin rango, los últimos 30 días que usó el backend', () => {
    expect(describirFiltros('top-productos', {})).toBe('Últimos 30 días');
    expect(describirFiltros('ventas', {})).toBe('Últimos 30 días · por día');
  });

  it('un extremo abierto se dice', () => {
    expect(describirFiltros('resumen', { desde: '2026-11-01' })).toBe('Desde el 1 nov 2026');
    expect(describirFiltros('resumen', { hasta: '2026-11-08' })).toBe('Hasta el 8 nov 2026');
  });

  it('unos filtros que no son de un reporte no rompen la lista', () => {
    expect(describirFiltros('resumen', { desde: 'ayer' })).toBe('Filtros no reconocidos');
  });
});
