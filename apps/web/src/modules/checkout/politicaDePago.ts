import type { ErrorApi } from '../../shared/api';

/**
 * Qué hace la pantalla con cada respuesta de error del pago (M4-H03, la tabla de la llave):
 * - `reintentar`: el resultado es incierto o hay un pago en curso; «Reintentar» reenvía el mismo intento con la
 *   **misma** llave, así nunca hay dos cobros (N-03).
 * - `corregir`: la pasarela respondió que no; el siguiente intento lleva una llave **nueva**.
 * - `volverAlCheckout` y `volverAlCarrito`: la sesión ya no sirve; la pantalla avisa y sale.
 * - `inesperado`: no debe pasar con esta política (una llave reutilizada con otra solicitud); se muestra el error
 *   con su `requestId` para reportarlo.
 */
export type Desenlace =
  | { tipo: 'reintentar'; llave: 'misma' }
  | { tipo: 'corregir'; llave: 'nueva' }
  | { tipo: 'volverAlCheckout' }
  | { tipo: 'volverAlCarrito' }
  | { tipo: 'inesperado'; llave: 'nueva' };

const REINTENTAR: Desenlace = { tipo: 'reintentar', llave: 'misma' };
const CORREGIR: Desenlace = { tipo: 'corregir', llave: 'nueva' };

// O de abierto/cerrado: un código nuevo es una fila más, no otra rama.
const POR_CODIGO: Partial<Record<string, Desenlace>> = {
  PAGO_SIN_CONFIRMAR: REINTENTAR,
  PAGO_EN_CURSO: REINTENTAR,
  PAGO_RECHAZADO: CORREGIR,
  PAGO_NO_COMPLETADO: CORREGIR,
  SESION_VENCIDA: { tipo: 'volverAlCheckout' },
  MAX_INTENTOS: { tipo: 'volverAlCarrito' },
};

const STATUS_VALIDACION = 400;
const PRIMER_STATUS_DEL_SERVIDOR = 500;

export function desenlaceDelPago(error: ErrorApi): Desenlace {
  const porCodigo = POR_CODIGO[error.codigo];
  if (porCodigo) return porCodigo;
  // Un 400 (la tarjeta vencida, un campo) se rechaza antes de registrar el intento: se corrige con otra llave.
  if (error.status === STATUS_VALIDACION) return CORREGIR;
  // Sin red o con un 5xx no se sabe si la pasarela cobró: solo la misma llave es segura (N-03).
  if (error.esDeRed || error.status >= PRIMER_STATUS_DEL_SERVIDOR) return REINTENTAR;
  return { tipo: 'inesperado', llave: 'nueva' };
}
