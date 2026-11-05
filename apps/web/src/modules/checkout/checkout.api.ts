import { api, ErrorApi, type Cuerpo, type Respuesta } from '../../shared/api';

export type SesionPago = Respuesta<'/api/v1/checkout/sesion', 'get'>['datos'];
export type IniciarSesionPago = Cuerpo<'/api/v1/checkout/sesion', 'post'>;

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
