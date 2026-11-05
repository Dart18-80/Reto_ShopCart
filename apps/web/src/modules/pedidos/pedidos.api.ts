import type { consultaPaginacionSchema } from '@shopcart/shared';
import type { z } from 'zod';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ConsultaMisPedidos = z.output<typeof consultaPaginacionSchema>;
export type ListaDePedidos = Respuesta<'/api/v1/pedidos', 'get'>;
export type ResumenPedido = ListaDePedidos['datos'][number];
export type Pedido = Respuesta<'/api/v1/pedidos/{id}', 'get'>['datos'];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function cuerpoDe<D>(data: D | undefined): D {
  if (data === undefined) throw ErrorApi.inesperado();
  return data;
}

// RF-01: los pedidos son del Cliente del token; nunca se envía su ID.

export async function listarMisPedidos(consulta: ConsultaMisPedidos): Promise<ListaDePedidos> {
  const { data } = await api.GET('/api/v1/pedidos', { params: { query: consulta } });
  return cuerpoDe(data);
}

/** Un pedido ajeno responde 404, igual que uno inexistente (RF-01). */
export async function obtenerPedido(idPedido: number): Promise<Pedido> {
  const { data } = await api.GET('/api/v1/pedidos/{id}', { params: { path: { id: idPedido } } });
  return cuerpoDe(data).datos;
}
