import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { servidor } from '../../test/servidor';
import { crearClienteApi } from './cliente';
import { ErrorApi } from './ErrorApi';

const REQUEST_ID = '6f1c2a9e-0b6d-4c1e-9a55-1b8f0b7c3d21';

const errorDelBackend = (status: number, error: Record<string, unknown>) =>
  HttpResponse.json({ error: { requestId: REQUEST_ID, ...error } }, { status });

/** El ErrorApi con el que termina la llamada (falla la prueba si la llamada no lanza). */
async function errorDe(llamada: Promise<unknown>): Promise<ErrorApi> {
  try {
    await llamada;
  } catch (error) {
    if (error instanceof ErrorApi) return error;
    throw error;
  }
  throw new Error('La llamada debía lanzar un ErrorApi');
}

const sinSesion = crearClienteApi({ obtenerToken: () => null });

describe('cliente api: errores del backend → ErrorApi (A-06)', () => {
  it('un 400 de validación conserva los detalles por campo', async () => {
    const detalles = [{ campo: 'body.nombreRecibe', mensaje: 'Escribe quién recibe.' }];
    servidor.use(
      http.post('/api/v1/direcciones', () =>
        errorDelBackend(400, {
          codigo: 'PARAMETRO_INVALIDO',
          mensaje: 'Los datos enviados no son válidos.',
          detalles,
        }),
      ),
    );

    const error = await errorDe(sinSesion.POST('/api/v1/direcciones', { body: {} as never }));

    expect(error).toMatchObject({
      status: 400,
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'Los datos enviados no son válidos.',
      detalles,
      requestId: REQUEST_ID,
    });
  });

  it('un 409 conserva los detalles de objeto', async () => {
    servidor.use(
      http.put('/api/v1/carrito/cupon', () =>
        errorDelBackend(409, {
          codigo: 'CUPON_MONTO_MINIMO',
          mensaje: 'Te faltan Q25.00 para usar este cupón.',
          detalles: { faltante: '25.00' },
        }),
      ),
    );

    const error = await errorDe(sinSesion.PUT('/api/v1/carrito/cupon', { body: {} as never }));

    expect(error).toMatchObject({
      status: 409,
      codigo: 'CUPON_MONTO_MINIMO',
      detalles: { faltante: '25.00' },
      requestId: REQUEST_ID,
    });
  });

  it('un 500 sin cuerpo es un error genérico que conserva el status y el X-Request-Id', async () => {
    servidor.use(
      http.get(
        '/api/v1/carrito',
        () => new HttpResponse(null, { status: 500, headers: { 'X-Request-Id': REQUEST_ID } }),
      ),
    );

    const error = await errorDe(sinSesion.GET('/api/v1/carrito'));

    expect(error).toMatchObject({
      status: 500,
      codigo: 'RESPUESTA_INESPERADA',
      requestId: REQUEST_ID,
    });
    expect(error.mensaje).not.toBe('');
  });

  it('una falla de red es un ErrorApi con código RED y status 0', async () => {
    servidor.use(http.get('/api/v1/carrito', () => HttpResponse.error()));

    const error = await errorDe(sinSesion.GET('/api/v1/carrito'));

    expect(error).toMatchObject({ status: 0, codigo: 'RED', requestId: null });
  });
});

describe('cliente api: token y respuestas exitosas', () => {
  it('agrega Authorization: Bearer cuando la sesión tiene token', async () => {
    let autorizacion: string | null = 'sin leer';
    servidor.use(
      http.get('/api/v1/carrito', ({ request }) => {
        autorizacion = request.headers.get('Authorization');
        return HttpResponse.json({ datos: {} });
      }),
    );

    await crearClienteApi({ obtenerToken: () => 'token-de-prueba' }).GET('/api/v1/carrito');

    expect(autorizacion).toBe('Bearer token-de-prueba');
  });

  it('sin token no envía Authorization', async () => {
    let autorizacion: string | null = 'sin leer';
    servidor.use(
      http.get('/api/v1/carrito', ({ request }) => {
        autorizacion = request.headers.get('Authorization');
        return HttpResponse.json({ datos: {} });
      }),
    );

    await sinSesion.GET('/api/v1/carrito');

    expect(autorizacion).toBeNull();
  });

  it('una respuesta exitosa llega como data', async () => {
    servidor.use(http.get('/api/v1/carrito', () => HttpResponse.json({ datos: { lineas: [] } })));

    const { data } = await sinSesion.GET('/api/v1/carrito');

    expect(data).toEqual({ datos: { lineas: [] } });
  });
});
