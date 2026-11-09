import type { ActualizarConfiguracion } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Configuracion = Respuesta<'/api/v1/admin/configuracion', 'get'>['datos'];

// A-14: los parámetros del sistema (solo Admin). El monto del envío gratis va y viene como texto (FE-10).

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const { data } = await api.GET('/api/v1/admin/configuracion');
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

export async function actualizarConfiguracion(
  cuerpo: ActualizarConfiguracion,
): Promise<Configuracion> {
  const { data } = await api.PATCH('/api/v1/admin/configuracion', { body: cuerpo });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}
