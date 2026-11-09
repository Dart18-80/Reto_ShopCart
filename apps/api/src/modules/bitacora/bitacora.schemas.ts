// A-08: z extendido antes de evaluar @shopcart/shared (ver shared/openapi/zod.ts).
import { z } from '../../shared/openapi/zod.js';
// FE-03 (M10-H02): la consulta vive en @shopcart/shared, la misma que valida la URL del backoffice.
import { consultaBitacoraSchema } from '@shopcart/shared';

export { consultaBitacoraSchema };
export type { ConsultaBitacora } from '@shopcart/shared';

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
