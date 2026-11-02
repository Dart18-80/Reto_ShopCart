import { consultaPaginacionSchema, idEnRutaSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_EXPORTACION, FORMATOS, REPORTES_EXPORTABLES } from './exportaciones.types.js';

export const paramsReporteSchema = z.object({ reporte: z.enum(REPORTES_EXPORTABLES) });
export const paramsIdExportacionSchema = z.object({ id: idEnRutaSchema });
export const listarExportacionesSchema = consultaPaginacionSchema;

// Los filtros se validan con el esquema del propio reporte (el mismo del dashboard) en el servicio.
export const solicitarExportacionSchema = z
  .object({
    formato: z.enum(FORMATOS),
    filtros: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()
  .openapi('SolicitarExportacion');

export const exportacionSchema = z
  .object({
    idExportacion: z.number().int(),
    reporte: z.enum(REPORTES_EXPORTABLES),
    formato: z.enum(FORMATOS),
    filtros: z.record(z.string(), z.unknown()),
    estado: z.enum(ESTADOS_EXPORTACION),
    intentos: z.number().int(),
    error: z.string().nullable(),
    tamanoBytes: z.number().int().nullable(),
    fechaCreacion: z.iso.datetime(),
    fechaFinalizacion: z.iso.datetime().nullable(),
    fechaExpiracion: z.iso.datetime().nullable(),
    /** El enlace de descarga cuando está Completada; nunca una ruta del sistema. */
    archivo: z.string().nullable(),
  })
  .openapi('Exportacion');

export type SolicitarExportacion = z.infer<typeof solicitarExportacionSchema>;
export type ListarExportaciones = z.infer<typeof listarExportacionesSchema>;
