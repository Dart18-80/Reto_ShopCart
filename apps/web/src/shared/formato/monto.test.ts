import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatearMonto, formatearPorcentaje } from './monto';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatearMonto (FE-10)', () => {
  it('formatea el mayor monto de DECIMAL(12,2) con el texto exacto', () => {
    expect(formatearMonto('9999999999.99')).toBe('Q9,999,999,999.99');
  });

  it('formatea un monto negativo (ventas netas, A-21)', () => {
    expect(formatearMonto('-12.00')).toBe('-Q12.00');
  });

  it('completa los centavos y separa los miles como en Figma', () => {
    expect(formatearMonto('1035')).toBe('Q1,035.00');
    expect(formatearMonto('0.5')).toBe('Q0.50');
  });

  it('nunca convierte el monto a number: Intl recibe el texto tal cual', () => {
    const formatToParts = vi.spyOn(Intl.NumberFormat.prototype, 'formatToParts');
    const numero = vi.spyOn(globalThis, 'Number');
    const parseFloatEspia = vi.spyOn(globalThis, 'parseFloat');

    formatearMonto('9999999999.99');

    expect(formatToParts).toHaveBeenCalledWith('9999999999.99');
    expect(numero).not.toHaveBeenCalled();
    expect(parseFloatEspia).not.toHaveBeenCalled();
  });

  it('un texto que no es un monto es un error del programa, no un «NaN» en pantalla', () => {
    expect(() => formatearMonto('Q12')).toThrow(/no es un monto/);
    expect(() => formatearMonto('')).toThrow(/no es un monto/);
  });
});

describe('formatearPorcentaje (M9-H01, FE-10)', () => {
  it.each([
    ['10.00', '10 %'],
    ['12.50', '12.5 %'],
    ['7.25', '7.25 %'],
    ['100', '100 %'],
  ])('«%s» se lee «%s»', (valor, esperado) => {
    expect(formatearPorcentaje(valor)).toBe(esperado);
  });

  it('un texto que no es decimal es un error del programa', () => {
    expect(() => formatearPorcentaje('diez')).toThrow(/no es un porcentaje/);
  });
});
