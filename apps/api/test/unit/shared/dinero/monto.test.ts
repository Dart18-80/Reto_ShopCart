import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { aMonto, montoATexto, montoParaSql } from '../../../../src/shared/dinero/index.js';

// Lo que entrega el driver para un DECIMAL(12,2) es un number de JS (A-21).
describe('aMonto (A-21)', () => {
  it.each([
    [0.01, '0.01'],
    [0.1, '0.10'],
    [149.9, '149.90'],
    [9999999999.99, '9999999999.99'],
    [-35, '-35.00'],
    [0, '0.00'],
  ])('convierte %d sin perder centavos: %s', (valor, texto) => {
    expect(aMonto(valor).toFixed(2)).toBe(texto);
  });

  it('redondea a 2 decimales un promedio periódico (1.666… → 1.67)', () => {
    expect(aMonto(5 / 3).toFixed(2)).toBe('1.67');
  });

  it.each([1e13, -1e13, Number.NaN, Number.POSITIVE_INFINITY])(
    'falla con un valor fuera de lo que un DECIMAL(15,2) puede traer sin perder precisión: %d',
    (valor) => {
      expect(() => aMonto(valor)).toThrow(/A-21/);
    },
  );

  it('acepta el mayor valor de un DECIMAL(15,2)', () => {
    expect(aMonto(9999999999999.99).toFixed(2)).toBe('9999999999999.99');
  });
});

describe('montoParaSql (A-21)', () => {
  it.each(['0.01', '0.10', '149.90', '9999999999.99'])(
    'convierte el Decimal %s al number que espera el driver',
    (texto) => {
      expect(montoParaSql(new Decimal(texto))).toBe(Number(texto));
    },
  );

  it('falla con un valor de 1e13 o más', () => {
    expect(() => montoParaSql(new Decimal('10000000000000'))).toThrow(/A-21/);
  });
});

describe('montoATexto (A-21)', () => {
  it('sale como texto con dos decimales, aunque el Decimal tenga menos', () => {
    expect(montoATexto(new Decimal('149.9'))).toBe('149.90');
    expect(montoATexto(aMonto(1500))).toBe('1500.00');
  });
});
