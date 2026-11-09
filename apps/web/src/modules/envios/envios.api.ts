import type { ActualizarMetodoEnvio } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type MetodosEnvio = Respuesta<'/api/v1/envios/metodos', 'get'>['datos'];
export type MetodoEnvio = MetodosEnvio['metodos'][number];
export type MetodoEnvioAdmin = Respuesta<'/api/v1/admin/envios/metodos', 'get'>['datos'][number];

/** N-04: los métodos con su costo y el total con envío para el carrito de quien pide, calculados en el SP. */
export async function listarMetodosParaCarrito(): Promise<MetodosEnvio> {
  const { data } = await api.GET('/api/v1/envios/metodos');
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** M9-H02: todos los métodos, también los inactivos, con su costo base (solo Admin). */
export async function listarMetodosAdmin(): Promise<MetodoEnvioAdmin[]> {
  const { data } = await api.GET('/api/v1/admin/envios/metodos');
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** N-04: reemplaza nombre, costo, días y estado; el SP exige que quede al menos un método activo. */
export async function actualizarMetodoEnvio(
  idMetodoEnvio: number,
  cuerpo: ActualizarMetodoEnvio,
): Promise<MetodoEnvioAdmin> {
  const { data } = await api.PUT('/api/v1/admin/envios/metodos/{id}', {
    params: { path: { id: idMetodoEnvio } },
    body: cuerpo,
  });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}
