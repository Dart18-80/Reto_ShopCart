import { pipeline } from 'node:stream/promises';
import type { RequestHandler, Response } from 'express';
import { manejar, paginar } from '../../shared/http/index.js';
import {
  listarExportacionesSchema,
  paramsIdExportacionSchema,
  paramsReporteSchema,
  solicitarExportacionSchema,
} from './exportaciones.schemas.js';
import type { ExportacionesService } from './exportaciones.service.js';
import type { Exportacion } from './exportaciones.types.js';

const esDescargaCancelada = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ERR_STREAM_PREMATURE_CLOSE';

export const RUTA_EXPORTACIONES = '/api/v1/admin/exportaciones';
// Cada cuánto conviene volver a consultar una exportación que todavía no termina.
const SEGUNDOS_PARA_CONSULTAR = 2;

export interface ExportacionesController {
  solicitar: RequestHandler;
  listar: RequestHandler;
  obtener: RequestHandler;
  descargar: RequestHandler;
}

// Nunca una ruta del sistema: solo el enlace del endpoint que descarga el archivo.
const aRespuesta = (e: Exportacion) => ({
  idExportacion: e.idExportacion,
  reporte: e.reporte,
  formato: e.formato,
  filtros: e.filtros,
  estado: e.estado,
  intentos: e.intentos,
  error: e.error,
  tamanoBytes: e.tamanoBytes,
  fechaCreacion: e.fechaCreacion.toISOString(),
  fechaFinalizacion: e.fechaFinalizacion?.toISOString() ?? null,
  fechaExpiracion: e.fechaExpiracion?.toISOString() ?? null,
  archivo:
    e.estado === 'Completada' ? `${RUTA_EXPORTACIONES}/${String(e.idExportacion)}/archivo` : null,
});

function reintentarSiNoTermino(res: Response, { estado }: Exportacion): void {
  if (estado === 'Pendiente' || estado === 'Procesando') {
    res.setHeader('Retry-After', String(SEGUNDOS_PARA_CONSULTAR));
  }
}

export function crearExportacionesController(
  servicio: ExportacionesService,
): ExportacionesController {
  return {
    solicitar: manejar(
      { params: paramsReporteSchema, body: solicitarExportacionSchema },
      async ({ params, body }, res) => {
        const { exportacion } = await servicio.solicitar(params.reporte, body);
        reintentarSiNoTermino(res, exportacion);
        res
          .status(202)
          .location(`${RUTA_EXPORTACIONES}/${String(exportacion.idExportacion)}`)
          .json({ datos: aRespuesta(exportacion) });
      },
    ),

    listar: manejar({ query: listarExportacionesSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.listar(query);
      res.json(paginar(filas.map(aRespuesta), total, query));
    }),

    obtener: manejar({ params: paramsIdExportacionSchema }, async ({ params }, res) => {
      const exportacion = await servicio.obtener(params.id);
      reintentarSiNoTermino(res, exportacion);
      res.json({ datos: aRespuesta(exportacion) });
    }),

    descargar: manejar({ params: paramsIdExportacionSchema }, async ({ params }, res) => {
      const archivo = await servicio.archivo(params.id);
      res.attachment(archivo.nombreDescarga);
      res.setHeader('Content-Type', archivo.tipoContenido);
      res.setHeader('Content-Length', String(archivo.tamanoBytes));
      try {
        await pipeline(archivo.contenido, res);
      } catch (error) {
        // El cliente cerró la conexión a mitad de la descarga: es normal y no hay nada que responder.
        if (!esDescargaCancelada(error)) throw error;
      }
    }),
  };
}
