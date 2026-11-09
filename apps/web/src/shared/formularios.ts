import { z } from 'zod';

/**
 * FE-03: un campo de texto que pide un entero («-3», «20»). Solo convierte lo escrito; los límites los pone el
 * esquema compartido al que se encadena (`enteroDelCampo.pipe(esquema.shape.cantidad)`).
 */
export const enteroDelCampo = z
  .string()
  .trim()
  .regex(/^-?\d+$/, 'Escribe un número entero.')
  .transform(Number);
