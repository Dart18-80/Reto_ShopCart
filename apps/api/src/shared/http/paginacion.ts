import { z } from '../openapi/zod.js';

export const TAMANO_MAXIMO_PAGINA = 100;
// Los SPs calculan OFFSET (@Pagina - 1) * @Tamano en INT: una página mayor lo desbordaría (500).
const PAGINA_MAXIMA = Math.floor(2_147_483_647 / TAMANO_MAXIMO_PAGINA);

export const consultaPaginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(PAGINA_MAXIMA).default(1),
  tamano: z.coerce.number().int().min(1).max(TAMANO_MAXIMO_PAGINA).default(20),
});

export type ConsultaPaginacion = z.infer<typeof consultaPaginacionSchema>;

export interface RespuestaPaginada<T> {
  datos: T[];
  paginacion: { pagina: number; tamano: number; total: number; totalPaginas: number };
}

/** Formato estándar de listados. `total` viene del `COUNT(*) OVER ()` del SP (columna TotalFilas). */
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
