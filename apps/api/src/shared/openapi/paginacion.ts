import { z } from './zod.js';

// La forma de RespuestaPaginada (shared/http) para la documentación: un solo componente en OpenAPI.
const paginacionSchema = z
  .object({
    pagina: z.number().int(),
    tamano: z.number().int(),
    total: z.number().int(),
    totalPaginas: z.number().int(),
  })
  .openapi('Paginacion');

/** El sobre de todo listado paginado: `{ datos: fila[], paginacion }`. */
export const respuestaPaginadaSchema = <T extends z.ZodType>(fila: T) =>
  z.object({ datos: z.array(fila), paginacion: paginacionSchema });
