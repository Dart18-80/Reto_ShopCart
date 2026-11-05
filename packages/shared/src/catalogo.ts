import { z } from 'zod';
import { booleanoConsultaSchema, consultaPaginacionSchema, idEnRutaSchema } from './consultas.js';
import { montoMenorOIgual, montoSchema } from './monto.js';
import { textoNvarchar } from './texto.js';

/**
 * El largo máximo del texto de búsqueda del catálogo: el parámetro @Texto NVARCHAR(150) de los SPs de búsqueda. La
 * API lo valida con textoNvarchar y la web lo pone como maxLength del buscador.
 */
export const LARGO_MAXIMO_TEXTO_BUSQUEDA = 150;

/**
 * FE-15: las ilustraciones de prenda con que la tienda dibuja los productos de cada categoría. Es la misma lista del
 * CHECK CK_Categoria_Ilustracion (V025); la web tiene un dibujo por cada una.
 */
export const ILUSTRACIONES_PRENDA = [
  'Camisa',
  'Pantalon',
  'Vestido',
  'Chaqueta',
  'Tenis',
  'Gorra',
] as const;
export type IlustracionPrenda = (typeof ILUSTRACIONES_PRENDA)[number];

export const ORDENES_BUSQUEDA = ['relevancia', 'precio', 'nombre', 'recientes'] as const;
export const DIRECCIONES_ORDEN = ['asc', 'desc'] as const;

interface RangoDePrecio {
  precioMin?: string | undefined;
  precioMax?: string | undefined;
}
const rangoDePrecioValido = ({ precioMin, precioMax }: RangoDePrecio) =>
  precioMin === undefined || precioMax === undefined || montoMenorOIgual(precioMin, precioMax);
const RANGO_INVERTIDO = {
  message: 'El precio mínimo no puede ser mayor que el máximo.',
  path: ['precioMin'],
};

/** Los dos campos de precio del filtro de la tienda, con la misma regla que la query completa. */
export const filtroPrecioSchema = z
  .object({ precioMin: montoSchema.optional(), precioMax: montoSchema.optional() })
  .refine(rangoDePrecioValido, RANGO_INVERTIDO);

/**
 * La query de GET /productos (M2-H02): la misma en la API y en la URL de la tienda (FE-06). Los precios llegan como
 * texto y se validan con montoSchema; la API los convierte a Decimal. El SP vuelve a validar el orden y el rango.
 */
export const consultaBusquedaSchema = consultaPaginacionSchema
  .extend({
    texto: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
    categoria: idEnRutaSchema.optional(),
    precioMin: montoSchema.optional(),
    precioMax: montoSchema.optional(),
    disponible: booleanoConsultaSchema.optional(),
    orden: z
      .enum(ORDENES_BUSQUEDA)
      .default('relevancia')
      .describe(
        'relevancia (por defecto): primero lo que empieza con el texto; sin texto equivale a nombre ' +
          'ascendente. precio: el menor precio vigente entre las variantes activas. nombre. recientes: ' +
          'FechaCreacion descendente. ' +
          'Todo orden termina con idProducto, así la paginación no repite ni pierde productos.',
      ),
    direccion: z
      .enum(DIRECCIONES_ORDEN)
      .default('asc')
      .describe('asc (por defecto) o desc; no aplica a relevancia ni a recientes.'),
  })
  .refine(rangoDePrecioValido, RANGO_INVERTIDO);

export type ConsultaBusqueda = z.infer<typeof consultaBusquedaSchema>;
export type FiltroPrecio = z.infer<typeof filtroPrecioSchema>;
