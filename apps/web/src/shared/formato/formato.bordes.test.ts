import { describe, expect, it } from 'vitest';
import { formatearFechaCalendario, formatearFechaHora } from './fecha';
import { formatearMonto } from './monto';

describe('formatearMonto: casos borde', () => {
  it.each([
    ['0', 'Q0.00'],
    ['00012.50', 'Q12.50'],
    ['0.01', 'Q0.01'],
    ['-0.01', '-Q0.01'],
  ])('«%s» → «%s»', (monto, esperado) => {
    expect(formatearMonto(monto)).toBe(esperado);
  });

  it.each([' 12.00', '12.00 ', '1e5', '+12', '.5', '12.', '12,50', '١٢', 'NaN', 'Infinity', '--1'])(
    '«%s» no es un monto del backend y es un error del programa',
    (monto) => {
      expect(() => formatearMonto(monto)).toThrow(/no es un monto/);
    },
  );
});

describe('formatearFechaHora: casos borde', () => {
  it('una fecha sin hora no es un instante: es un error, no la medianoche UTC del día anterior', () => {
    expect(() => formatearFechaHora('2026-11-03')).toThrow(/no es una fecha con hora/);
  });

  it('un instante sin zona depende del navegador: se rechaza', () => {
    expect(() => formatearFechaHora('2026-11-03T10:00:00')).toThrow(/no es una fecha con hora/);
  });

  it('acepta un instante con desplazamiento explícito', () => {
    expect(formatearFechaHora('2026-11-03T10:42:00-06:00')).toBe('3 nov 2026, 10:42');
  });

  it('el cambio de año en Guatemala: 31 dic 23:59 aunque en UTC ya sea 1 de enero', () => {
    expect(formatearFechaHora('2027-01-01T05:59:00.000Z')).toBe('31 dic 2026, 23:59');
  });
});

describe('formatearFechaCalendario: casos borde', () => {
  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(formatearFechaCalendario('2028-02-29')).toBe('29 feb 2028');
  });

  it.each([
    '2026-02-29',
    '2026-02-30',
    '2026-04-31',
    '2026-00-10',
    '2026-11-00',
    '2026-11-3',
    ' 2026-11-03',
  ])('«%s» no es una fecha de calendario válida', (fecha) => {
    expect(() => formatearFechaCalendario(fecha)).toThrow(/AAAA-MM-DD/);
  });
});
