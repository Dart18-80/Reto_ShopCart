import { z } from 'zod';
import { DIRECCIONES_ORDEN } from './catalogo.js';

export type DireccionOrden = (typeof DIRECCIONES_ORDEN)[number];

/**
 * M6-H01 (A-10, FE-06): `orden` y `direccion` de un listado. La lista blanca de cada endpoint es su enum; el SP la
 * vuelve a validar y ordena con CASE sobre ella, siempre con el desempate por la PK. Se agrega a un esquema de
 * consulta con `.extend(ordenConsultaSchema(…).shape)`.
 */
export function ordenConsultaSchema<const C extends readonly [string, ...string[]]>(
  columnas: C,
  porDefecto: C[number],
  direccionPorDefecto: DireccionOrden,
) {
  return z.object({
    orden: z
      .enum(columnas)
      .default(porDefecto)
      .describe(`Columna del orden (por defecto, ${porDefecto}); el desempate es siempre la PK.`),
    direccion: z
      .enum(DIRECCIONES_ORDEN)
      .default(direccionPorDefecto)
      .describe(`asc o desc (por defecto, ${direccionPorDefecto}).`),
  });
}
