import { z } from '../openapi/zod.js';

/**
 * A-12: un rango de días de Guatemala, con los dos extremos opcionales e incluidos. La regla vive solo aquí; cada
 * consulta le agrega sus campos con `safeExtend`, que conserva la regla (`extend` la perdería).
 */
export const rangoDeFechasSchema = z
  .object({ desde: z.iso.date().optional(), hasta: z.iso.date().optional() })
  .refine(({ desde, hasta }) => desde === undefined || hasta === undefined || desde <= hasta, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['desde'],
  });
