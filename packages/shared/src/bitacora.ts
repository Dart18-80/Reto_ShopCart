import { z } from 'zod';
import { consultaPaginacionSchema, rangoDeFechasSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';

/** RF-09: los módulos que registran en la bitácora (CK_Bitacora_Modulo). */
export const MODULOS_BITACORA = [
  'Catalogo',
  'Inventario',
  'Cupones',
  'Pedidos',
  'Envios',
  'Usuarios',
  'Configuracion',
] as const;
export type ModuloBitacora = (typeof MODULOS_BITACORA)[number];

/**
 * RF-09, E7-H02 (M10-H02 la usa en el backoffice, FE-03): la consulta de la bitácora. Las fechas son días de
 * Guatemala (A-12); la entidad se compara exacta (Bitacora.Entidad).
 */
export const consultaBitacoraSchema = rangoDeFechasSchema.safeExtend({
  ...consultaPaginacionSchema.shape,
  modulo: z.enum(MODULOS_BITACORA).optional(),
  entidad: z.string().trim().min(1).max(50).optional(),
  ...ordenConsultaSchema(['fecha'], 'fecha', 'desc').shape,
});

export type ConsultaBitacora = z.infer<typeof consultaBitacoraSchema>;
