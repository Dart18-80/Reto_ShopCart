import { z } from '../openapi/zod.js';

/** Un filtro booleano de la query string: solo 'true' o 'false'. */
export const booleanoConsultaSchema = z
  .enum(['true', 'false'])
  .transform((valor) => valor === 'true');
