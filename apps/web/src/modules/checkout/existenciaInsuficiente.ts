import { z } from 'zod';
import type { ErrorApi } from '../../shared/api';

const lineasSinExistenciaSchema = z.array(
  z.object({
    idVariante: z.number(),
    producto: z.string(),
    cantidad: z.number(),
    disponible: z.number(),
  }),
);

export type LineaSinExistencia = z.infer<typeof lineasSinExistenciaSchema>[number];

/**
 * N-06: el 409 STOCK_INSUFICIENTE trae en `detalles` todas las líneas que no alcanzan, con su disponible (A-19).
 * Con otro error, o con detalles que no tienen esa forma, devuelve `null` y basta el mensaje del backend.
 */
export function lineasSinExistencia(error: ErrorApi): LineaSinExistencia[] | null {
  if (error.codigo !== 'STOCK_INSUFICIENTE') return null;
  const lineas = lineasSinExistenciaSchema.safeParse(error.detalles);
  return lineas.success ? lineas.data : null;
}
