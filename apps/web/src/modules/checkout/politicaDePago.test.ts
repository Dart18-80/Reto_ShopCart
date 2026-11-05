import { describe, expect, it } from 'vitest';
import { ErrorApi } from '../../shared/api';
import { desenlaceDelPago } from './politicaDePago';

const error = (status: number, codigo: string) =>
  new ErrorApi({
    status,
    codigo,
    mensaje: 'mensaje del backend',
    detalles: undefined,
    requestId: 'r',
  });

describe('desenlaceDelPago: la tabla de la llave (M4-H03, RF-06)', () => {
  it.each([
    [
      '504 PAGO_SIN_CONFIRMAR',
      error(504, 'PAGO_SIN_CONFIRMAR'),
      { tipo: 'reintentar', llave: 'misma' },
    ],
    ['una falla de red', ErrorApi.deRed(), { tipo: 'reintentar', llave: 'misma' }],
    ['409 PAGO_EN_CURSO', error(409, 'PAGO_EN_CURSO'), { tipo: 'reintentar', llave: 'misma' }],
    ['402 PAGO_RECHAZADO', error(402, 'PAGO_RECHAZADO'), { tipo: 'corregir', llave: 'nueva' }],
    [
      '409 PAGO_NO_COMPLETADO',
      error(409, 'PAGO_NO_COMPLETADO'),
      { tipo: 'corregir', llave: 'nueva' },
    ],
    ['409 SESION_VENCIDA', error(409, 'SESION_VENCIDA'), { tipo: 'volverAlCheckout' }],
    ['409 MAX_INTENTOS', error(409, 'MAX_INTENTOS'), { tipo: 'volverAlCarrito' }],
    [
      '422 LLAVE_REUTILIZADA',
      error(422, 'LLAVE_REUTILIZADA'),
      { tipo: 'inesperado', llave: 'nueva' },
    ],
  ])('%s', (_fila, respuesta, desenlace) => {
    expect(desenlaceDelPago(respuesta)).toEqual(desenlace);
  });

  it('un 400 (la tarjeta vencida) se corrige con una llave nueva: el intento nunca se registró', () => {
    expect(desenlaceDelPago(error(400, 'VALIDACION_FALLIDA'))).toEqual({
      tipo: 'corregir',
      llave: 'nueva',
    });
  });

  it('otro 5xx es incierto como el 504: la misma llave', () => {
    expect(desenlaceDelPago(error(500, 'ERROR_INTERNO'))).toEqual({
      tipo: 'reintentar',
      llave: 'misma',
    });
  });
});
