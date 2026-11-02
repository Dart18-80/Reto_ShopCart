import { consultaPaginacionSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { MODULOS_BITACORA } from './bitacora.types.js';

// A-12: las fechas son días de Guatemala.
export const consultaBitacoraSchema = consultaPaginacionSchema
  .extend({
    modulo: z.enum(MODULOS_BITACORA).optional(),
    entidad: z.string().trim().min(1).max(50).optional(),
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
  })
  .refine(({ desde, hasta }) => desde === undefined || hasta === undefined || desde <= hasta, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['desde'],
  });

export type ConsultaBitacora = z.infer<typeof consultaBitacoraSchema>;

export const registroBitacoraSchema = z
  .object({
    idBitacora: z.string(),
    modulo: z.string(),
    entidad: z.string(),
    idEntidad: z.string(),
    accion: z.string(),
    valorAnterior: z.unknown(),
    valorNuevo: z.unknown(),
    usuario: z.object({ idUsuario: z.number().int(), nombre: z.string() }).nullable(),
    requestId: z.string().nullable(),
    fecha: z.iso.datetime(),
  })
  .openapi('RegistroBitacora');
