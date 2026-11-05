import { z } from 'zod';

export const TAMANO_MAXIMO_PAGINA = 100;
// Los SPs calculan OFFSET (@Pagina - 1) * @Tamano en INT: una página mayor lo desbordaría (500).
const PAGINA_MAXIMA = Math.floor(2_147_483_647 / TAMANO_MAXIMO_PAGINA);

/** La paginación estándar de los listados: llega de la URL como texto. */
export const consultaPaginacionSchema = z.object({
  pagina: z.coerce.number().int().min(1).max(PAGINA_MAXIMA).default(1),
  tamano: z.coerce.number().int().min(1).max(TAMANO_MAXIMO_PAGINA).default(20),
});

// Las PK son INT: un ID fuera de ese rango tiene que ser un 400 de validación y no un error de mssql al
// armar el parámetro sql.Int (500).
export const idSchema = z.int32().positive();

/** El mismo ID cuando llega como texto en la ruta o en la consulta. */
export const idEnRutaSchema = z.coerce.number().pipe(idSchema);

/** Un filtro booleano de la query string: solo 'true' o 'false'. */
export const booleanoConsultaSchema = z
  .enum(['true', 'false'])
  .transform((valor) => valor === 'true');
