// A-08: z extendido antes de evaluar @shopcart/shared (ver shared/openapi/zod.ts).
import type { z } from '../openapi/zod.js';
import '../openapi/zod.js';
import type { consultaPaginacionSchema } from '@shopcart/shared';

// FE-06: la misma paginación valida la API y la URL de la web.
export { consultaPaginacionSchema, TAMANO_MAXIMO_PAGINA } from '@shopcart/shared';

export type ConsultaPaginacion = z.infer<typeof consultaPaginacionSchema>;

export interface RespuestaPaginada<T> {
  datos: T[];
  paginacion: { pagina: number; tamano: number; total: number; totalPaginas: number };
}

/** Formato estándar de listados. `total` viene del segundo conjunto del SP (ejecutarSPPaginado). */
export function paginar<T>(
  datos: T[],
  total: number,
  { pagina, tamano }: ConsultaPaginacion,
): RespuestaPaginada<T> {
  return {
    datos,
    paginacion: { pagina, tamano, total, totalPaginas: Math.ceil(total / tamano) },
  };
}
