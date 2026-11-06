import {
  actualizarCategoriaSchema as actualizarCategoriaCompartido,
  actualizarProductoSchema as actualizarProductoCompartido,
  actualizarVarianteSchema as actualizarVarianteCompartido,
  cambiarPrecioSchema as cambiarPrecioCompartido,
  consultaBusquedaSchema,
  consultaProductosAdminSchema,
  crearAtributoSchema as crearAtributoCompartido,
  crearCategoriaSchema as crearCategoriaCompartido,
  crearProductoSchema as crearProductoCompartido,
  crearVarianteSchema as crearVarianteCompartido,
  guardarImagenesSchema as guardarImagenesCompartido,
  crearValorAtributoSchema as crearValorAtributoCompartido,
  ilustracionSchema,
  montoSchema,
} from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_EXISTENCIA } from './catalogo.types.js';

// FE-03: los cuerpos de categorías y atributos viven en @shopcart/shared, los mismos que validan los formularios
// del backoffice (M6-H02).

export const crearCategoriaSchema = registroOpenApi.register(
  'CrearCategoria',
  crearCategoriaCompartido,
);
export const actualizarCategoriaSchema = registroOpenApi.register(
  'ActualizarCategoria',
  actualizarCategoriaCompartido,
);

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

export const categoriaAdminSchema = categoriaSchema
  .extend({ productos: z.number().int() })
  .openapi('CategoriaAdmin');

// --- Atributos (E3-H02).

export const crearAtributoSchema = registroOpenApi.register(
  'CrearAtributo',
  crearAtributoCompartido,
);
export const crearValorAtributoSchema = registroOpenApi.register(
  'CrearValorAtributo',
  crearValorAtributoCompartido,
);

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

export const crearProductoSchema = registroOpenApi.register(
  'CrearProducto',
  crearProductoCompartido,
);

export const actualizarProductoSchema = registroOpenApi.register(
  'ActualizarProducto',
  actualizarProductoCompartido,
);

export const paramsIdProductoSchema = z.object({ id: idEnRutaSchema });

// M6-H03: la consulta vive en @shopcart/shared, la misma que arma la tabla del backoffice.
export const listarProductosSchema = consultaProductosAdminSchema;

// M6-H04: los cuerpos del editor viven en @shopcart/shared. Las rutas documentan el esquema compartido; el
// controlador valida con la versión de entrada, que además pasa el precio de texto a Decimal (A-21).
export const guardarImagenesSchema = registroOpenApi.register(
  'GuardarImagenes',
  guardarImagenesCompartido,
);

export const crearVarianteSchema = registroOpenApi.register(
  'CrearVariante',
  crearVarianteCompartido,
);
export const crearVarianteEntradaSchema = crearVarianteSchema.transform(({ precio, ...resto }) => ({
  ...resto,
  precio: new Decimal(precio),
}));

export const actualizarVarianteSchema = registroOpenApi.register(
  'ActualizarVariante',
  actualizarVarianteCompartido,
);

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

export const cambiarPrecioSchema = registroOpenApi.register(
  'CambiarPrecio',
  cambiarPrecioCompartido,
);
export const cambiarPrecioEntradaSchema = cambiarPrecioSchema.transform(({ precio }) => ({
  precio: new Decimal(precio),
}));

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
export type CrearVariante = z.output<typeof crearVarianteEntradaSchema>;
export type ActualizarVariante = z.infer<typeof actualizarVarianteSchema>;
export type CambiarPrecio = z.output<typeof cambiarPrecioEntradaSchema>;
