import type {
  CambiarEstadoPedido,
  CancelarPedido,
  ConsultaPedidosGestion,
  consultaPaginacionSchema,
  ConsultaReembolsos,
  RegistrarDevolucion,
  ResolverPago,
  ResolverReembolso,
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
export type ListaReembolsos = Respuesta<'/api/v1/admin/reembolsos', 'get'>;
export type Reembolso = ListaReembolsos['datos'][number];
export type ListaPagosEnRevision = Respuesta<'/api/v1/admin/pagos/en-revision', 'get'>;
export type PagoEnRevision = ListaPagosEnRevision['datos'][number];
export type ReembolsoReintentado = Respuesta<
  '/api/v1/admin/reembolsos/{id}/reintentar',
  'post'
>['datos'];
export type DevolucionRegistrada = Respuesta<
  '/api/v1/admin/pedidos/{id}/devoluciones',
  'post'
>['datos'];

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

/** N-08: el SP lo mueve solo si sigue en `estadoEsperado` (si no, 409 CONFLICTO_CONCURRENCIA). */
export async function cambiarEstadoPedido(
  idPedido: number,
  cuerpo: CambiarEstadoPedido,
): Promise<Pedido> {
  const { data } = await api.POST('/api/v1/admin/pedidos/{id}/estado', {
    params: { path: { id: idPedido } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

/** N-09: la cancelación desde la gestión; responde el pedido y el reembolso que creó. */
export async function cancelarPedidoGestion(
  idPedido: number,
  cuerpo: CancelarPedido,
): Promise<Cancelacion> {
  const { data } = await api.POST('/api/v1/admin/pedidos/{id}/cancelar', {
    params: { path: { id: idPedido } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

/** N-10: la devolución por línea; responde el pedido, la devolución con su reembolso calculado y el reembolso. */
export async function registrarDevolucion(
  idPedido: number,
  cuerpo: RegistrarDevolucion,
): Promise<DevolucionRegistrada> {
  const { data } = await api.POST('/api/v1/admin/pedidos/{id}/devoluciones', {
    params: { path: { id: idPedido } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

// --- Revisión manual (E9-H04, M8-H05): solo el Administrador.

export async function listarReembolsos(consulta: ConsultaReembolsos): Promise<ListaReembolsos> {
  const { data } = await api.GET('/api/v1/admin/reembolsos', { params: { query: consulta } });
  return cuerpoDe(data);
}

/** N-09: vuelve a Pendiente un Fallido y lo procesa con la misma llave (nunca reembolsa dos veces). */
export async function reintentarReembolso(idReembolso: number): Promise<ReembolsoReintentado> {
  const { data } = await api.POST('/api/v1/admin/reembolsos/{id}/reintentar', {
    params: { path: { id: idReembolso } },
  });
  return cuerpoDe(data).datos;
}

export async function resolverReembolso(
  idReembolso: number,
  cuerpo: ResolverReembolso,
): Promise<Reembolso> {
  const { data } = await api.POST('/api/v1/admin/reembolsos/{id}/resolver', {
    params: { path: { id: idReembolso } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

export async function listarPagosEnRevision(
  consulta: ConsultaMisPedidos,
): Promise<ListaPagosEnRevision> {
  const { data } = await api.GET('/api/v1/admin/pagos/en-revision', {
    params: { query: consulta },
  });
  return cuerpoDe(data);
}

// El contrato describe `pedido` (un Pedido o null) con un allOf que openapi-typescript vuelve inservible; el tipo
// sale de lo que devuelve el cliente `api`, que sí lo resuelve.
export async function resolverPago(idIntentoPago: number, cuerpo: ResolverPago) {
  const { data } = await api.POST('/api/v1/admin/pagos/{id}/resolver', {
    params: { path: { id: idIntentoPago } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

export type PagoResuelto = Awaited<ReturnType<typeof resolverPago>>;
