import { z } from '../openapi/zod.js';

// Las PK son INT: un ID fuera de ese rango tiene que ser un 400 de validación y no un error de mssql al
// armar el parámetro sql.Int (500).
export const idSchema = z.int32().positive();

/** El mismo ID cuando llega como texto en la ruta o en la consulta. */
export const idEnRutaSchema = z.coerce.number().pipe(idSchema);
