import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import {
  crearQueryClient,
  debeReintentar,
  guardarRespuesta,
  refrescar,
  REINTENTOS_MAXIMOS,
} from './consultas';
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

describe('refrescar (revisión de M10)', () => {
  it('una lectura que empezó antes de la mutación no queda como la respuesta: se pide otra', async () => {
    const queryClient = crearQueryClient();
    const respuestas: ((datos: string[]) => void)[] = [];
    // Una vista montada: la consulta tiene un observador activo, como la tabla de categorías.
    const vista = new QueryObserver(queryClient, {
      queryKey: ['categorias'],
      queryFn: () =>
        new Promise<string[]>((resolver) => {
          respuestas.push(resolver);
        }),
    });
    const dejarDeObservar = vista.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(respuestas).toHaveLength(1);
    });

    const refresco = refrescar(queryClient, { queryKey: ['categorias'] });
    // La lectura vieja (sin la categoría nueva) termina después de la mutación: no debe quedar como respuesta.
    respuestas[0]?.(['Camisas']);
    await vi.waitFor(() => {
      expect(respuestas).toHaveLength(2);
    });
    respuestas[1]?.(['Camisas', 'Gorras']);
    await refresco;

    expect(queryClient.getQueryData(['categorias'])).toEqual(['Camisas', 'Gorras']);
    dejarDeObservar();
  });
});

describe('guardarRespuesta (revisión de la Fase 2)', () => {
  it('la respuesta de la mutación no la pisa una lectura que empezó antes', async () => {
    const queryClient = crearQueryClient();
    const respuestas: ((datos: string) => void)[] = [];
    const vista = new QueryObserver(queryClient, {
      queryKey: ['carrito'],
      queryFn: () =>
        new Promise<string>((resolver) => {
          respuestas.push(resolver);
        }),
    });
    const dejarDeObservar = vista.subscribe(() => undefined);
    await vi.waitFor(() => {
      expect(respuestas).toHaveLength(1);
    });

    await guardarRespuesta(queryClient, ['carrito'], 'carrito con la línea nueva');
    // La lectura vieja termina después: ya no cuenta.
    respuestas[0]?.('carrito viejo');
    await new Promise((resolver) => setTimeout(resolver, 20));

    expect(queryClient.getQueryData(['carrito'])).toBe('carrito con la línea nueva');
    dejarDeObservar();
  });
});
