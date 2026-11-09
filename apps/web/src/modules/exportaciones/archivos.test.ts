import { describe, expect, it } from 'vitest';
import { nombreDelArchivo, segundosAMilisegundos } from './archivos';

describe('nombreDelArchivo (M11-H03)', () => {
  it('toma el nombre de Content-Disposition', () => {
    expect(nombreDelArchivo('attachment; filename="ventas-2026-11-08.xlsx"', 'respaldo.xlsx')).toBe(
      'ventas-2026-11-08.xlsx',
    );
  });

  it('prefiere filename* (UTF-8) cuando el nombre lleva tildes', () => {
    expect(
      nombreDelArchivo(
        `attachment; filename="ventas-por-categor_a.pdf"; filename*=UTF-8''ventas-por-categor%C3%ADa.pdf`,
        'respaldo.pdf',
      ),
    ).toBe('ventas-por-categoría.pdf');
  });

  it('sin el encabezado o sin nombre, usa el de respaldo', () => {
    expect(nombreDelArchivo(null, 'exportacion-7.xlsx')).toBe('exportacion-7.xlsx');
    expect(nombreDelArchivo('attachment', 'exportacion-7.xlsx')).toBe('exportacion-7.xlsx');
  });

  it('un nombre con rutas se reduce al último segmento', () => {
    expect(nombreDelArchivo('attachment; filename="../../etc/clave.pdf"', 'x.pdf')).toBe(
      'clave.pdf',
    );
  });
});

describe('segundosAMilisegundos (Retry-After)', () => {
  it('un número de segundos positivo', () => {
    expect(segundosAMilisegundos('2')).toBe(2000);
  });

  it('sin encabezado o con algo que no es un número, no hay reintento', () => {
    expect(segundosAMilisegundos(null)).toBeNull();
    expect(segundosAMilisegundos('mañana')).toBeNull();
    expect(segundosAMilisegundos('0')).toBeNull();
  });
});
