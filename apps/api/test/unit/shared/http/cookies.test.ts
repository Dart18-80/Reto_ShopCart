import { describe, expect, it } from 'vitest';
import { leerCookies } from '../../../../src/shared/http/index.js';

describe('leerCookies (A-07, sin cookie-parser por A-16)', () => {
  it('sin header devuelve un objeto vacío', () => {
    expect({ ...leerCookies(undefined) }).toEqual({});
  });

  it('lee varias cookies, recorta espacios y decodifica el valor', () => {
    expect({ ...leerCookies(' a=1 ;b=%20dos%20; c = tres ') }).toEqual({
      a: '1',
      b: ' dos ',
      c: 'tres',
    });
  });

  it('con una cookie repetida se queda con la primera', () => {
    expect(leerCookies('refresh=bueno; refresh=malo').refresh).toBe('bueno');
  });

  it('un valor que contiene "=" se conserva completo', () => {
    expect(leerCookies('refresh=abc==').refresh).toBe('abc==');
  });

  it('un valor con un % suelto se devuelve tal cual, sin lanzar', () => {
    expect(leerCookies('refresh=%E0%A4%A').refresh).toBe('%E0%A4%A');
  });

  it('ignora pares sin "=" o sin nombre', () => {
    expect({ ...leerCookies('suelto; =valor; ;a=1') }).toEqual({ a: '1' });
  });

  it('una cookie llamada __proto__ queda como dato propio y no toca Object.prototype', () => {
    const cookies = leerCookies('__proto__=x; constructor=y');

    expect(Object.getPrototypeOf(cookies)).toBeNull();
    expect(cookies.__proto__).toBe('x');
    expect(cookies.constructor).toBe('y');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
