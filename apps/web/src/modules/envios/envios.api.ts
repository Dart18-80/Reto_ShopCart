import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type MetodosEnvio = Respuesta<'/api/v1/envios/metodos', 'get'>['datos'];
export type MetodoEnvio = MetodosEnvio['metodos'][number];

/** N-04: los métodos con su costo y el total con envío para el carrito de quien pide, calculados en el SP. */
export async function listarMetodosParaCarrito(): Promise<MetodosEnvio> {
  const { data } = await api.GET('/api/v1/envios/metodos');
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}
