import type { ReporteDashboard, SolicitarExportacion } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';
import { nombreDelArchivo, segundosAMilisegundos } from './archivos';

export type ListaExportaciones = Respuesta<'/api/v1/admin/exportaciones', 'get'>;
export type Exportacion = ListaExportaciones['datos'][number];

export interface ConsultaExportaciones {
  pagina: number;
  tamano: number;
}

/** La exportación y cuándo volver a preguntar por ella (`Retry-After`), mientras no termina. */
export interface SeguimientoExportacion {
  exportacion: Exportacion;
  reintentarEnMs: number | null;
}

export interface ArchivoDescargado {
  archivo: Blob;
  nombre: string;
}

const seguimiento = (exportacion: Exportacion, respuesta: Response): SeguimientoExportacion => ({
  exportacion,
  reintentarEnMs: segundosAMilisegundos(respuesta.headers.get('Retry-After')),
});

/**
 * RF-08 (solo Admin): pide el archivo de un reporte con los filtros que se ven en pantalla. Es asíncrona: responde
 * 202 con la exportación Pendiente (o la igual que ya estaba vigente).
 */
export async function solicitarExportacion(
  reporte: ReporteDashboard,
  solicitud: SolicitarExportacion,
): Promise<SeguimientoExportacion> {
  const { data, response } = await api.POST('/api/v1/admin/reportes/{reporte}/exportaciones', {
    params: { path: { reporte } },
    body: solicitud,
  });
  if (!data) throw ErrorApi.inesperado();
  return seguimiento(data.datos, response);
}

/** Mis exportaciones, las más recientes primero. */
export async function listarExportaciones(
  consulta: ConsultaExportaciones,
): Promise<ListaExportaciones> {
  const { data } = await api.GET('/api/v1/admin/exportaciones', { params: { query: consulta } });
  if (!data) throw ErrorApi.inesperado();
  return data;
}

/** El estado de una de mis exportaciones (una ajena responde 404). */
export async function obtenerExportacion(idExportacion: number): Promise<SeguimientoExportacion> {
  const { data, response } = await api.GET('/api/v1/admin/exportaciones/{id}', {
    params: { path: { id: idExportacion } },
  });
  if (!data) throw ErrorApi.inesperado();
  return seguimiento(data.datos, response);
}

/**
 * El archivo de una exportación Completada. Lleva el token, por eso se pide con el cliente `api` y no con un enlace;
 * 409 si todavía no termina y 410 si ya venció, con el mensaje del backend.
 */
export async function descargarExportacion({
  idExportacion,
  formato,
}: Exportacion): Promise<ArchivoDescargado> {
  const { data, response } = await api.GET('/api/v1/admin/exportaciones/{id}/archivo', {
    params: { path: { id: idExportacion } },
    parseAs: 'blob',
  });
  if (!data) throw ErrorApi.inesperado();
  return {
    archivo: data,
    nombre: nombreDelArchivo(
      response.headers.get('Content-Disposition'),
      `exportacion-${String(idExportacion)}.${formato}`,
    ),
  };
}
