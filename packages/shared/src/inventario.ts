import type { z } from 'zod';
import { LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
import { consultaPaginacionSchema, idEnRutaSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';
import { textoNvarchar } from './texto.js';

// M6-H01: el orden; M7-H01: el texto busca en el producto (sin tildes ni mayúsculas) y en el SKU por su prefijo.
export const ordenExistenciasSchema = ordenConsultaSchema(
  ['sku', 'producto', 'disponible'],
  'disponible',
  'asc',
);

export const consultaExistenciasSchema = consultaPaginacionSchema.extend({
  variante: idEnRutaSchema.optional(),
  texto: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
  ...ordenExistenciasSchema.shape,
});

export type ConsultaExistencias = z.infer<typeof consultaExistenciasSchema>;
export type OrdenExistencias = z.infer<typeof ordenExistenciasSchema>;
