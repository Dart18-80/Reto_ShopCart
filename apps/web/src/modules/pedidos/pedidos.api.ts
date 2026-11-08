import type {
  CancelarPedido,
  ConsultaPedidosGestion,
  consultaPaginacionSchema,
} from '@shopcart/shared';
import type { z } from 'zod';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ConsultaMisPedidos = z.output<typeof consultaPaginacionSchema>;
export type ListaDePedidos = Respuesta<'/api/v1/pedidos', 'get'>;
export type ResumenPedido = ListaDePedidos['datos'][number];
export type Pedido = Respuesta<'/api/v1/pedidos/{id}', 'get'>['datos'];
export type Cancelacion = Respuesta<'/api/v1/pedidos/{id}/cancelar', 'post'>['datos'];
export type EstadoReembolso = Cancelacion['reembolso']['estado'];
export type ListaGestion = Respuesta<'/api/v1/admin/pedidos', 'get'>;
export type ResumenGestion = ListaGestion['datos'][number];
export type PedidoGestion = Respuesta<'/api/v1/admin/pedidos/{id}', 'get'>['datos'];

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

/** N-09, RF-07: cancela el pedido con su motivo; responde el pedido actualizado y el reembolso que creó. */
export async function cancelarPedido(
  idPedido: number,
  cuerpo: CancelarPedido,
): Promise<Cancelacion> {
  const { data } = await api.POST('/api/v1/pedidos/{id}/cancelar', {
    params: { path: { id: idPedido } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

// --- Gestión (M8, Operador y Administrador): cualquier pedido, filtrado y ordenado por el servidor.

export async function listarPedidosGestion(
  consulta: ConsultaPedidosGestion,
): Promise<ListaGestion> {
  const { data } = await api.GET('/api/v1/admin/pedidos', { params: { query: consulta } });
  return cuerpoDe(data);
}

/** M8-H01: el pedido con su cliente y lo que la gestión puede hacer con él ahora, calculado por el backend. */
export async function obtenerPedidoGestion(idPedido: number): Promise<PedidoGestion> {
  const { data } = await api.GET('/api/v1/admin/pedidos/{id}', {
    params: { path: { id: idPedido } },
  });
  return cuerpoDe(data).datos;
}
