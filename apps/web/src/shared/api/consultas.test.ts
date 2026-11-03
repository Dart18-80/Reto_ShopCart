import { describe, expect, it } from 'vitest';
import { crearQueryClient, debeReintentar, REINTENTOS_MAXIMOS } from './consultas';
import { ErrorApi } from './ErrorApi';

const errorConStatus = (status: number) =>
  new ErrorApi({ status, codigo: 'X', mensaje: 'x', detalles: undefined, requestId: null });

describe('debeReintentar (FE-02)', () => {
  it.each([400, 401, 403, 404, 409, 422, 429])(
    'no reintenta un %i: es un error de negocio',
    (status) => {
      expect(debeReintentar(0, errorConStatus(status))).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])('reintenta un %i', (status) => {
    expect(debeReintentar(0, errorConStatus(status))).toBe(true);
  });

  it('reintenta una falla de red', () => {
    expect(debeReintentar(0, ErrorApi.deRed())).toBe(true);
  });

  it(`deja de reintentar después de ${String(REINTENTOS_MAXIMOS)} reintentos`, () => {
    expect(debeReintentar(REINTENTOS_MAXIMOS - 1, ErrorApi.deRed())).toBe(true);
    expect(debeReintentar(REINTENTOS_MAXIMOS, ErrorApi.deRed())).toBe(false);
  });

  it('no reintenta un error que no viene de la API (un error de programación)', () => {
    expect(debeReintentar(0, new TypeError('x'))).toBe(false);
  });
});

describe('crearQueryClient (FE-02)', () => {
  it('las consultas usan debeReintentar y las mutaciones nunca se reintentan', () => {
    const opciones = crearQueryClient().getDefaultOptions();

    expect(opciones.queries?.retry).toBe(debeReintentar);
    expect(opciones.mutations?.retry).toBe(false);
  });
});
