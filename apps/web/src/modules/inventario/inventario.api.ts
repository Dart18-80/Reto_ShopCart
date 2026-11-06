import type { ConsultaExistencias, RegistrarAjuste, RegistrarEntrada } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ListaExistencias = Respuesta<'/api/v1/inventario/existencias', 'get'>;
export type Existencia = ListaExistencias['datos'][number];
export type Descuadre = Respuesta<'/api/v1/inventario/conciliacion', 'get'>['datos'][number];
export type ListaKardex = Respuesta<'/api/v1/inventario/kardex', 'get'>;
export type Movimiento = ListaKardex['datos'][number];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function cuerpoDe<D>(data: D | undefined): D {
  if (data === undefined) throw ErrorApi.inesperado();
  return data;
}

export async function listarExistencias(consulta: ConsultaExistencias): Promise<ListaExistencias> {
  const { data } = await api.GET('/api/v1/inventario/existencias', {
    params: { query: consulta },
  });
  return cuerpoDe(data);
}

export async function obtenerConciliacion(): Promise<Descuadre[]> {
  const { data } = await api.GET('/api/v1/inventario/conciliacion');
  return cuerpoDe(data).datos;
}

export async function listarKardex(idVariante: number, pagina: number): Promise<ListaKardex> {
  const { data } = await api.GET('/api/v1/inventario/kardex', {
    params: { query: { variante: idVariante, pagina } },
  });
  return cuerpoDe(data);
}

export async function registrarEntrada(cuerpo: RegistrarEntrada): Promise<Movimiento> {
  const { data } = await api.POST('/api/v1/inventario/entradas', { body: cuerpo });
  return cuerpoDe(data).datos;
}

export async function registrarAjuste(cuerpo: RegistrarAjuste): Promise<Movimiento> {
  const { data } = await api.POST('/api/v1/inventario/ajustes', { body: cuerpo });
  return cuerpoDe(data).datos;
}
