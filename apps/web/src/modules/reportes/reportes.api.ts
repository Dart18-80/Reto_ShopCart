import type { ConsultaCarritos, ConsultaVentas, RangoDeFechas } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Resumen = Respuesta<'/api/v1/dashboard/resumen', 'get'>['datos'];
export type VentasDelPeriodo = Respuesta<'/api/v1/dashboard/ventas', 'get'>['datos'][number];
export type VentasDeCategoria = Respuesta<
  '/api/v1/dashboard/ventas-por-categoria',
  'get'
>['datos'][number];
export type ProductoVendido = Respuesta<'/api/v1/dashboard/top-productos', 'get'>['datos'][number];
export type ListaCarritos = Respuesta<'/api/v1/dashboard/carritos-abandonados', 'get'>;
export type CarritoAbandonado = ListaCarritos['datos'][number];

/** RF-08 (solo Admin): las cifras del periodo y el rango que el backend usó (sin rango, los últimos 30 días). */
export async function obtenerResumen(rango: RangoDeFechas): Promise<Resumen> {
  const { data } = await api.GET('/api/v1/dashboard/resumen', { params: { query: rango } });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** Un periodo por fila, en orden; las ventas netas pueden ser negativas (N-11). */
export async function obtenerVentas(consulta: ConsultaVentas): Promise<VentasDelPeriodo[]> {
  const { data } = await api.GET('/api/v1/dashboard/ventas', { params: { query: consulta } });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** De mayor a menor venta, en el orden del backend. */
export async function obtenerVentasPorCategoria(
  rango: RangoDeFechas,
): Promise<VentasDeCategoria[]> {
  const { data } = await api.GET('/api/v1/dashboard/ventas-por-categoria', {
    params: { query: rango },
  });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** Los 10 más vendidos por unidades, en el orden del backend. */
export async function obtenerTopProductos(rango: RangoDeFechas): Promise<ProductoVendido[]> {
  const { data } = await api.GET('/api/v1/dashboard/top-productos', { params: { query: rango } });
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

/** N-13: los carritos abandonados del periodo, paginados y con el orden de M6-H01. */
export async function listarCarritosAbandonados(
  consulta: ConsultaCarritos,
): Promise<ListaCarritos> {
  const { data } = await api.GET('/api/v1/dashboard/carritos-abandonados', {
    params: { query: consulta },
  });
  if (!data) throw ErrorApi.inesperado();
  return data;
}

/**
 * E9-H02 (A-25): el stream del dashboard. Sale por el cliente `api`, así lleva el token en `Authorization` y, ante
 * un 401 (token vencido), renueva una vez y reintenta; si la renovación falla, la sesión se cierra (05 §5).
 */
export async function abrirEventosReportes(
  ultimoEventoId: string | null,
  senal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const { data } = await api.GET('/api/v1/admin/reportes/eventos', {
    params: { header: ultimoEventoId === null ? {} : { 'last-event-id': ultimoEventoId } },
    headers: { Accept: 'text/event-stream' },
    parseAs: 'stream',
    signal: senal,
  });
  if (!data) throw ErrorApi.inesperado();
  return data;
}
