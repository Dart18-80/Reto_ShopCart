import { z } from 'zod';
import { consultaPaginacionSchema, rangoDeFechasSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';

/** RF-08: cómo se agrupan las ventas por periodo (el día, la semana desde el lunes o el mes). */
export const AGRUPACIONES = ['dia', 'semana', 'mes'] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

/** RF-08 (M11-H01 la usa en el dashboard, FE-03): el rango de días de Guatemala (A-12) y la agrupación. */
export const consultaVentasSchema = rangoDeFechasSchema.safeExtend({
  agrupacion: z.enum(AGRUPACIONES).default('dia'),
});

// M6-H01: por defecto, del mayor monto potencial al menor (lo supone la exportación); inactividad desc es la
// última actividad más antigua primero.
export const ordenCarritosSchema = ordenConsultaSchema(['inactividad', 'total'], 'total', 'desc');

/** RF-08: los carritos abandonados del rango, paginados y con el orden de M6-H01. */
export const consultaCarritosSchema = rangoDeFechasSchema.safeExtend({
  ...consultaPaginacionSchema.shape,
  ...ordenCarritosSchema.shape,
});

export type ConsultaVentas = z.infer<typeof consultaVentasSchema>;
export type OrdenCarritos = z.infer<typeof ordenCarritosSchema>;
export type ConsultaCarritos = z.infer<typeof consultaCarritosSchema>;
