import { z } from '../openapi/zod.js';

// Los IDs INT de la ruta y la consulta los valida igual la web (@shopcart/shared).
export { idEnRutaSchema, idSchema } from '@shopcart/shared';

/** Una PK BIGINT (IntentoPago) en la ruta: todo el rango de enteros seguros de JavaScript, sin perder precisión. */
export const idBigintEnRutaSchema = z.coerce.number().pipe(z.int().positive());
