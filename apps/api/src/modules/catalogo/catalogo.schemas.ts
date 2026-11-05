import {
  consultaBusquedaSchema,
  ILUSTRACIONES_PRENDA,
  LARGO_MAXIMO_TEXTO_BUSQUEDA,
  montoSchema,
  textoNvarchar,
} from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import {
  booleanoConsultaSchema,
  consultaPaginacionSchema,
  idEnRutaSchema,
  idSchema,
} from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_EXISTENCIA } from './catalogo.types.js';

const alMenosUnCampo = (cambios: object) => Object.keys(cambios).length > 0;
const MENSAJE_SIN_CAMPOS = 'Indica al menos un campo.';

// Orden de despliegue: SMALLINT en la tabla. Sin orden, el SP lo pone después del último.
const ordenSchema = z.number().int().min(0).max(32_767);

// --- Categorías (E3-H01). Largos de la tabla y los SPs: Nombre NVARCHAR(80), Descripcion NVARCHAR(300).

// FE-15: la misma lista del CHECK de la base; sin ilustración, la base pone la suya por defecto.
const ilustracionSchema = z.enum(ILUSTRACIONES_PRENDA);

export const crearCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80),
    descripcion: textoNvarchar(300).optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict()
  .openapi('CrearCategoria');

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80).optional(),
    descripcion: textoNvarchar(300).nullable().optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict()
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS)
  .openapi('ActualizarCategoria');

export const paramsIdCategoriaSchema = z.object({ id: idEnRutaSchema });

export const categoriaPublicaSchema = z
  .object({
    idCategoria: z.number().int(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    ilustracion: ilustracionSchema,
  })
  .openapi('CategoriaPublica');

export const categoriaSchema = categoriaPublicaSchema
  .extend({ activo: z.boolean() })
  .openapi('Categoria');

// --- Atributos (E3-H02).

export const crearAtributoSchema = z
  .object({ nombre: textoNvarchar(50), orden: ordenSchema.optional() })
  .strict()
  .openapi('CrearAtributo');

export const crearValorAtributoSchema = z
  .object({ valor: textoNvarchar(50), orden: ordenSchema.optional() })
  .strict()
  .openapi('CrearValorAtributo');

export const paramsIdAtributoSchema = z.object({ id: idEnRutaSchema });

const valorAtributoSchema = z.object({
  idValorAtributo: z.number().int(),
  valor: z.string(),
  orden: z.number().int(),
});

export const valorAtributoCreadoSchema = valorAtributoSchema
  .extend({ idAtributo: z.number().int() })
  .openapi('ValorAtributo');

export const atributoSchema = z
  .object({
    idAtributo: z.number().int(),
    nombre: z.string(),
    orden: z.number().int(),
    valores: z.array(valorAtributoSchema),
  })
  .openapi('Atributo');

// --- Productos e imágenes (E3-H03). Nombre NVARCHAR(150), Descripcion NVARCHAR(2000).

export const crearProductoSchema = z
  .object({
    idCategoria: idSchema,
    nombre: textoNvarchar(150),
    descripcion: textoNvarchar(2000).optional(),
    activo: z.boolean().default(true),
  })
  .strict()
  .openapi('CrearProducto');

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarProductoSchema = z
  .object({
    idCategoria: idSchema.optional(),
    nombre: textoNvarchar(150).optional(),
    descripcion: textoNvarchar(2000).nullable().optional(),
  })
  .strict()
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS)
  .openapi('ActualizarProducto');

export const paramsIdProductoSchema = z.object({ id: idEnRutaSchema });

// "categoria", igual que en la búsqueda pública.
export const listarProductosSchema = consultaPaginacionSchema.extend({
  categoria: idEnRutaSchema.optional(),
  activo: booleanoConsultaSchema.optional(),
  texto: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
});

const MAXIMO_IMAGENES = 20;

// N-19: una URL absoluta o una ruta servida por el contenedor web (/static/productos/…).
const urlImagenSchema = textoNvarchar(500).refine(
  (url) => url.startsWith('/') || /^https?:\/\//i.test(url),
  'La URL debe empezar con / o con http(s)://.',
);

const imagenSchema = z
  .object({
    url: urlImagenSchema,
    textoAlternativo: textoNvarchar(150),
    orden: ordenSchema,
    esPrincipal: z.boolean(),
  })
  .strict();

// El SP vuelve a validar lo mismo (A-22); aquí se responde antes y con el campo en el error.
export const guardarImagenesSchema = z
  .object({ imagenes: z.array(imagenSchema).max(MAXIMO_IMAGENES) })
  .strict()
  .refine(
    ({ imagenes }) =>
      imagenes.length === 0 || imagenes.filter((imagen) => imagen.esPrincipal).length === 1,
    { message: 'Debe haber exactamente una imagen principal.', path: ['imagenes'] },
  )
  .refine(
    ({ imagenes }) => new Set(imagenes.map((imagen) => imagen.orden)).size === imagenes.length,
    { message: 'Dos imágenes no pueden tener el mismo orden.', path: ['imagenes'] },
  )
  .openapi('GuardarImagenes');

// --- Variantes (E3-H03).

// SKU VARCHAR(40): solo ASCII visible, porque un carácter fuera de ASCII se perdería en la base.
const skuSchema = z
  .string()
  .trim()
  .regex(/^[\x21-\x7E]{1,40}$/, 'El SKU tiene de 1 a 40 caracteres ASCII visibles, sin espacios.');

// A-22: la combinación son IDs de ValorAtributo; el SP valida existencia, repetidos y el conjunto.
const MAXIMO_VALORES = 4;
const valoresSchema = z.array(idSchema).max(MAXIMO_VALORES);

const precioSchema = montoSchema
  .refine((precio) => !/^0+(\.0+)?$/.test(precio), 'El precio debe ser mayor que cero.')
  .transform((precio) => new Decimal(precio));

export const crearVarianteSchema = z
  .object({ sku: skuSchema, valores: valoresSchema, precio: precioSchema })
  .strict()
  .openapi('CrearVariante');

export const actualizarVarianteSchema = z
  .object({ sku: skuSchema.optional(), valores: valoresSchema.optional() })
  .strict()
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS)
  .openapi('ActualizarVariante');

export const paramsIdVarianteSchema = z.object({ id: idEnRutaSchema });

// --- Búsqueda (E3-H05, M2-H02): la query vive en @shopcart/shared, la misma que valida la URL de la tienda. Los
// precios llegan como texto y aquí pasan a Decimal (A-21). El SP vuelve a validar el orden y el rango.
const aDecimal = (monto: string | undefined) => (monto === undefined ? null : new Decimal(monto));
export const buscarProductosSchema = consultaBusquedaSchema.transform((consulta) => ({
  ...consulta,
  precioMin: aDecimal(consulta.precioMin),
  precioMax: aDecimal(consulta.precioMax),
}));

export const productoBusquedaSchema = z
  .object({
    idProducto: z.number().int(),
    nombre: z.string(),
    idCategoria: z.number().int(),
    categoria: z.string(),
    ilustracion: ilustracionSchema,
    precioMinimo: montoSchema,
    disponible: z.boolean(),
    imagenPrincipal: z.string().nullable(),
    colores: z.array(z.string()).openapi({
      description:
        'FE-16: los valores distintos del atributo Color de las variantes activas, en su orden, hasta 5',
    }),
  })
  .openapi('ProductoBusqueda');

// --- Precios (E3-H04).

export const cambiarPrecioSchema = z
  .object({ precio: precioSchema })
  .strict()
  .openapi('CambiarPrecio');

export const versionPrecioSchema = z
  .object({
    idPrecioVariante: z.number().int(),
    precio: montoSchema,
    vigenteDesde: z.iso.datetime(),
    vigenteHasta: z.iso.datetime().nullable(),
    usuario: z.object({ idUsuario: z.number().int(), nombre: z.string() }),
  })
  .openapi('VersionPrecio');

// --- Respuestas (OpenAPI). Los montos viajan como texto (A-21).

const imagenRespuestaSchema = z.object({
  idImagenProducto: z.number().int(),
  url: z.string(),
  textoAlternativo: z.string(),
  orden: z.number().int(),
  esPrincipal: z.boolean(),
});

const valorDeVarianteSchema = z.object({
  idAtributo: z.number().int(),
  atributo: z.string(),
  idValorAtributo: z.number().int(),
  valor: z.string(),
});

export const productoAdminSchema = z
  .object({
    idProducto: z.number().int(),
    idCategoria: z.number().int(),
    categoria: z.string(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    activo: z.boolean(),
    imagenes: z.array(imagenRespuestaSchema),
    variantes: z.array(
      z.object({
        idVariante: z.number().int(),
        sku: z.string(),
        descripcionAtributos: z.string(),
        activo: z.boolean(),
        precio: montoSchema.nullable(),
        existenciaFisica: z.number().int(),
        reservado: z.number().int(),
        disponible: z.number().int(),
        valores: z.array(valorDeVarianteSchema),
      }),
    ),
  })
  .openapi('ProductoAdmin');

// N-06: sin existencia física ni reservada; unidadesRestantes solo con UltimasUnidades.
const valorDeVarianteTiendaSchema = valorDeVarianteSchema.extend({
  orden: z.number().int().openapi({
    description:
      'ValorAtributo.Orden: la tienda muestra las opciones de cada atributo en este orden',
  }),
});

export const productoTiendaSchema = z
  .object({
    idProducto: z.number().int(),
    idCategoria: z.number().int(),
    categoria: z.string(),
    ilustracion: ilustracionSchema,
    nombre: z.string(),
    descripcion: z.string().nullable(),
    diasGarantiaPrecio: z.number().int().openapi({
      description:
        'N-02: días que el carrito garantiza el precio de una línea; lo configura el Admin',
    }),
    imagenes: z.array(imagenRespuestaSchema),
    variantes: z.array(
      z.object({
        idVariante: z.number().int(),
        sku: z.string(),
        descripcionAtributos: z.string(),
        precio: montoSchema,
        estadoExistencia: z.enum(ESTADOS_EXISTENCIA),
        unidadesRestantes: z.number().int().optional(),
        valores: z.array(valorDeVarianteTiendaSchema),
      }),
    ),
  })
  .openapi('ProductoTienda');

export const productoResumenSchema = z
  .object({
    idProducto: z.number().int(),
    nombre: z.string(),
    idCategoria: z.number().int(),
    categoria: z.string(),
    activo: z.boolean(),
    variantes: z.number().int(),
    variantesActivas: z.number().int(),
  })
  .openapi('ProductoResumen');

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoria = z.infer<typeof actualizarCategoriaSchema>;
export type CrearAtributo = z.infer<typeof crearAtributoSchema>;
export type CrearValorAtributo = z.infer<typeof crearValorAtributoSchema>;
export type CrearProducto = z.infer<typeof crearProductoSchema>;
export type ActualizarProducto = z.infer<typeof actualizarProductoSchema>;
export type GuardarImagenes = z.infer<typeof guardarImagenesSchema>;
export type CrearVariante = z.infer<typeof crearVarianteSchema>;
export type ActualizarVariante = z.infer<typeof actualizarVarianteSchema>;
export type CambiarPrecio = z.infer<typeof cambiarPrecioSchema>;
