import { z } from 'zod';
import { ILUSTRACIONES_PRENDA, LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
import {
  booleanoConsultaSchema,
  consultaPaginacionSchema,
  idEnRutaSchema,
  idSchema,
} from './consultas.js';
import { montoSchema } from './monto.js';
import { ordenConsultaSchema } from './orden.js';
import { textoNvarchar } from './texto.js';
import { alMenosUnCampo } from './usuarios.js';

const SIN_CAMPOS = 'Indica al menos un campo.';

// Orden de despliegue: SMALLINT en la tabla. Sin orden, el SP lo pone después del último.
export const ordenDespliegueSchema = z.number().int().min(0).max(32_767);

// FE-15: la misma lista del CHECK de la base; sin ilustración, la base pone la suya por defecto.
export const ilustracionSchema = z.enum(ILUSTRACIONES_PRENDA);

// --- Categorías (E3-H01). Largos de la tabla y los SPs: Nombre NVARCHAR(80), Descripcion NVARCHAR(300).

export const crearCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80),
    descripcion: textoNvarchar(300).optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict();

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80).optional(),
    descripcion: textoNvarchar(300).nullable().optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict()
  .refine(alMenosUnCampo, SIN_CAMPOS);

// --- Atributos (E3-H02).

export const crearAtributoSchema = z
  .object({ nombre: textoNvarchar(50), orden: ordenDespliegueSchema.optional() })
  .strict();

export const crearValorAtributoSchema = z
  .object({ valor: textoNvarchar(50), orden: ordenDespliegueSchema.optional() })
  .strict();

// --- Productos (E3-H03, M6-H03).

// El mismo ID INT de idSchema, con el mensaje que ve quien no eligió la categoría en el formulario.
const ELIGE_UNA_CATEGORIA = 'Elige una categoría.';
const idCategoriaSchema = z.int32({ error: ELIGE_UNA_CATEGORIA }).positive(ELIGE_UNA_CATEGORIA);

export const crearProductoSchema = z
  .object({
    idCategoria: idCategoriaSchema,
    nombre: textoNvarchar(150),
    descripcion: textoNvarchar(2000).optional(),
    activo: z.boolean().default(true),
  })
  .strict();

export const ordenProductosAdminSchema = ordenConsultaSchema(
  ['nombre', 'categoria', 'recientes'],
  'nombre',
  'asc',
);

// "categoria", igual que en la búsqueda pública.
export const consultaProductosAdminSchema = consultaPaginacionSchema.extend({
  categoria: idEnRutaSchema.optional(),
  activo: booleanoConsultaSchema.optional(),
  texto: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
  ...ordenProductosAdminSchema.shape,
});

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarProductoSchema = z
  .object({
    idCategoria: idCategoriaSchema.optional(),
    nombre: textoNvarchar(150).optional(),
    descripcion: textoNvarchar(2000).nullable().optional(),
  })
  .strict()
  .refine(alMenosUnCampo, SIN_CAMPOS);

// --- Imágenes (N-19). El SP vuelve a validar lo mismo (A-22); aquí se responde antes y con el campo en el error.

const MAXIMO_IMAGENES = 20;

// Una URL absoluta o una ruta servida por el contenedor web (/static/productos/…).
const urlImagenSchema = textoNvarchar(500).refine(
  (url) => url.startsWith('/') || /^https?:\/\//i.test(url),
  'La URL debe empezar con / o con http(s)://.',
);

export const imagenProductoSchema = z
  .object({
    url: urlImagenSchema,
    textoAlternativo: textoNvarchar(150),
    orden: ordenDespliegueSchema,
    esPrincipal: z.boolean(),
  })
  .strict();

export const guardarImagenesSchema = z
  .object({ imagenes: z.array(imagenProductoSchema).max(MAXIMO_IMAGENES) })
  .strict()
  .refine(
    ({ imagenes }) =>
      imagenes.length === 0 || imagenes.filter((imagen) => imagen.esPrincipal).length === 1,
    { message: 'Debe haber exactamente una imagen principal.', path: ['imagenes'] },
  )
  .refine(
    ({ imagenes }) => new Set(imagenes.map((imagen) => imagen.orden)).size === imagenes.length,
    { message: 'Dos imágenes no pueden tener el mismo orden.', path: ['imagenes'] },
  );

// --- Variantes (E3-H03) y precios (E3-H04). El precio viaja como texto (FE-10); la API lo pasa a Decimal.

// SKU VARCHAR(40): solo ASCII visible, porque un carácter fuera de ASCII se perdería en la base.
const skuSchema = z
  .string()
  .trim()
  .regex(/^[\x21-\x7E]{1,40}$/, 'El SKU tiene de 1 a 40 caracteres ASCII visibles, sin espacios.');

// A-22: la combinación son IDs de ValorAtributo; el SP valida existencia, repetidos y el conjunto.
const MAXIMO_VALORES = 4;
const valoresSchema = z.array(idSchema).max(MAXIMO_VALORES);

export const precioVarianteSchema = montoSchema.refine(
  (precio) => !/^0+(\.0+)?$/.test(precio),
  'El precio debe ser mayor que cero.',
);

export const crearVarianteSchema = z
  .object({ sku: skuSchema, valores: valoresSchema, precio: precioVarianteSchema })
  .strict();

export const actualizarVarianteSchema = z
  .object({ sku: skuSchema.optional(), valores: valoresSchema.optional() })
  .strict()
  .refine(alMenosUnCampo, SIN_CAMPOS);

export const cambiarPrecioSchema = z.object({ precio: precioVarianteSchema }).strict();

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoria = z.infer<typeof actualizarCategoriaSchema>;
export type CrearAtributo = z.infer<typeof crearAtributoSchema>;
export type CrearValorAtributo = z.infer<typeof crearValorAtributoSchema>;
export type CrearProducto = z.infer<typeof crearProductoSchema>;
export type ConsultaProductosAdmin = z.infer<typeof consultaProductosAdminSchema>;
export type OrdenProductosAdmin = z.infer<typeof ordenProductosAdminSchema>;
export type ActualizarProducto = z.infer<typeof actualizarProductoSchema>;
export type ImagenProducto = z.infer<typeof imagenProductoSchema>;
export type GuardarImagenes = z.infer<typeof guardarImagenesSchema>;
export type DatosVariante = z.infer<typeof crearVarianteSchema>;
export type ActualizarVariante = z.infer<typeof actualizarVarianteSchema>;
export type DatosPrecio = z.infer<typeof cambiarPrecioSchema>;
