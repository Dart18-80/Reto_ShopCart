import type { Pagar } from '@shopcart/shared';
import { api, ErrorApi, type Cuerpo, type Respuesta } from '../../shared/api';

export type SesionPago = Respuesta<'/api/v1/checkout/sesion', 'get'>['datos'];
export type IniciarSesionPago = Cuerpo<'/api/v1/checkout/sesion', 'post'>;
export type Pedido = Respuesta<'/api/v1/checkout/sesion/pagos', 'post'>['datos'];

const SIN_SESION_ACTIVA = 404;

function sesionDe(data: { datos: SesionPago } | undefined): SesionPago {
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** La sesión de pago Activa del Cliente; `null` si no tiene (el backend responde 404). */
export async function obtenerSesion(): Promise<SesionPago | null> {
  try {
    const { data } = await api.GET('/api/v1/checkout/sesion');
    return sesionDe(data);
  } catch (error) {
    if (error instanceof ErrorApi && error.status === SIN_SESION_ACTIVA) return null;
    throw error;
  }
}

/** RF-06 (01 §6.1): reserva todo o nada y congela precios, descuento y envío. */
export async function iniciarSesion(cuerpo: IniciarSesionPago): Promise<SesionPago> {
  const { data } = await api.POST('/api/v1/checkout/sesion', { body: cuerpo });
  return sesionDe(data);
}

/**
 * RF-06 (01 §6.2): paga la sesión. La llave es la del intento: con la misma llave, el backend responde lo mismo
 * y nunca cobra dos veces (N-03). 201 crea el pedido; 200, ya estaba pagado.
 */
export async function pagar(tarjeta: Pagar, llave: string): Promise<Pedido> {
  const { data } = await api.POST('/api/v1/checkout/sesion/pagos', {
    params: { header: { 'idempotency-key': llave } },
    body: tarjeta,
  });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** Cancela la sesión Activa (libera reservas y cupón); si ya no había una (404), no hay nada que cancelar. */
export async function cancelarSesion(): Promise<void> {
  try {
    await api.DELETE('/api/v1/checkout/sesion');
  } catch (error) {
    if (error instanceof ErrorApi && error.status === SIN_SESION_ACTIVA) return;
    throw error;
  }
}
