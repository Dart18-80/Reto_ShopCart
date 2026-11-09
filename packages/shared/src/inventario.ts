import { z } from 'zod';
import { enteroEntre } from './numeros.js';
import { LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
import { consultaPaginacionSchema, idEnRutaSchema, idSchema } from './consultas.js';
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

// --- Entradas y ajustes (E3-H06; M7-H02 los usa en los formularios del backoffice, FE-03).

// Tope técnico de un movimiento: mantiene lejos el desborde de INT al sumar a la existencia.
export const CANTIDAD_MAXIMA_MOVIMIENTO = 1_000_000;

// CA de E3-H06: un motivo ausente, vacío o de solo espacios lo rechaza el SP con MOTIVO_REQUERIDO, no Zod.
const motivoSchema = z.union([textoNvarchar(250), z.string().regex(/^\s*$/)]).optional();

// El mismo ID INT de idSchema, con el mensaje que ve quien no eligió la variante en el formulario de la entrada.
const ELIGE_UNA_VARIANTE = 'Elige una variante.';
const idVarianteEntradaSchema = z.int32({ error: ELIGE_UNA_VARIANTE }).positive(ELIGE_UNA_VARIANTE);

export const registrarEntradaSchema = z
  .object({
    idVariante: idVarianteEntradaSchema,
    cantidad: enteroEntre(1, CANTIDAD_MAXIMA_MOVIMIENTO),
    motivo: motivoSchema,
    referencia: textoNvarchar(100).optional(),
  })
  .strict();

export const registrarAjusteSchema = z
  .object({
    idVariante: idSchema,
    cantidad: enteroEntre(-CANTIDAD_MAXIMA_MOVIMIENTO, CANTIDAD_MAXIMA_MOVIMIENTO).refine(
      (cantidad) => cantidad !== 0,
      'La cantidad del ajuste no puede ser cero.',
    ),
    motivo: motivoSchema,
  })
  .strict();

export type ConsultaExistencias = z.infer<typeof consultaExistenciasSchema>;
export type OrdenExistencias = z.infer<typeof ordenExistenciasSchema>;
export type RegistrarEntrada = z.infer<typeof registrarEntradaSchema>;
export type RegistrarAjuste = z.infer<typeof registrarAjusteSchema>;
