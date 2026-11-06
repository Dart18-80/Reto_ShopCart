import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar } from '../../shared/http/index.js';
import {
  actualizarCategoriaSchema,
  actualizarProductoSchema,
  actualizarVarianteSchema,
  buscarProductosSchema,
  cambiarPrecioSchema,
  crearAtributoSchema,
  crearCategoriaSchema,
  crearProductoSchema,
  crearValorAtributoSchema,
  crearVarianteSchema,
  guardarImagenesSchema,
  listarProductosSchema,
  paramsIdAtributoSchema,
  paramsIdCategoriaSchema,
  paramsIdProductoSchema,
  paramsIdVarianteSchema,
} from './catalogo.schemas.js';
import type { CatalogoService } from './catalogo.service.js';
import type {
  ProductoAdmin,
  ProductoBusqueda,
  ProductoTienda,
  VersionPrecio,
} from './catalogo.types.js';

const HTTP_CREADO = 201;
const HTTP_SIN_CONTENIDO = 204;

// A-21: los montos salen como texto con dos decimales.
const productoAdminJson = (producto: ProductoAdmin) => ({
  ...producto,
  variantes: producto.variantes.map((variante) => ({
    ...variante,
    precio: variante.precio === null ? null : montoATexto(variante.precio),
  })),
});

// N-06: unidadesRestantes solo aparece con UltimasUnidades; por encima del umbral no hay ninguna cifra.
const productoTiendaJson = (producto: ProductoTienda) => ({
  ...producto,
  variantes: producto.variantes.map(({ unidadesRestantes, precio, ...variante }) => ({
    ...variante,
    precio: montoATexto(precio),
    ...(unidadesRestantes === null ? {} : { unidadesRestantes }),
  })),
});

const busquedaJson = (producto: ProductoBusqueda) => ({
  ...producto,
  precioMinimo: montoATexto(producto.precioMinimo),
});

const versionesJson = (versiones: VersionPrecio[]) =>
  versiones.map((version) => ({ ...version, precio: montoATexto(version.precio) }));

export interface CatalogoController {
  listarCategorias: RequestHandler;
  listarCategoriasAdmin: RequestHandler;
  crearCategoria: RequestHandler;
  actualizarCategoria: RequestHandler;
  activarCategoria: RequestHandler;
  desactivarCategoria: RequestHandler;
  eliminarCategoria: RequestHandler;
  listarAtributos: RequestHandler;
  crearAtributo: RequestHandler;
  crearValorAtributo: RequestHandler;
  buscarProductos: RequestHandler;
  obtenerProductoTienda: RequestHandler;
  listarProductosAdmin: RequestHandler;
  obtenerProductoAdmin: RequestHandler;
  crearProducto: RequestHandler;
  actualizarProducto: RequestHandler;
  activarProducto: RequestHandler;
  desactivarProducto: RequestHandler;
  eliminarProducto: RequestHandler;
  guardarImagenes: RequestHandler;
  crearVariante: RequestHandler;
  actualizarVariante: RequestHandler;
  activarVariante: RequestHandler;
  desactivarVariante: RequestHandler;
  eliminarVariante: RequestHandler;
  historialPrecios: RequestHandler;
  cambiarPrecio: RequestHandler;
}

export function crearCatalogoController(servicio: CatalogoService): CatalogoController {
  return {
    listarCategorias: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listarCategorias() });
    }),

    listarCategoriasAdmin: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listarCategoriasAdmin() });
    }),

    crearCategoria: manejar({ body: crearCategoriaSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.crearCategoria(body) });
    }),

    actualizarCategoria: manejar(
      { params: paramsIdCategoriaSchema, body: actualizarCategoriaSchema },
      async ({ params, body }, res) => {
        res.json({ datos: await servicio.actualizarCategoria(params.id, body) });
      },
    ),

    activarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.activarCategoria(params.id) });
    }),

    desactivarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.desactivarCategoria(params.id) });
    }),

    eliminarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      await servicio.eliminarCategoria(params.id);
      res.status(HTTP_SIN_CONTENIDO).end();
    }),

    listarAtributos: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listarAtributos() });
    }),

    crearAtributo: manejar({ body: crearAtributoSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.crearAtributo(body) });
    }),

    crearValorAtributo: manejar(
      { params: paramsIdAtributoSchema, body: crearValorAtributoSchema },
      async ({ params, body }, res) => {
        res.status(HTTP_CREADO).json({ datos: await servicio.crearValorAtributo(params.id, body) });
      },
    ),

    buscarProductos: manejar({ query: buscarProductosSchema }, async ({ query }, res) => {
      const { datos, paginacion } = await servicio.buscarProductos({
        pagina: query.pagina,
        tamano: query.tamano,
        texto: query.texto ?? null,
        idCategoria: query.categoria ?? null,
        precioMin: query.precioMin,
        precioMax: query.precioMax,
        disponible: query.disponible ?? null,
        orden: query.orden,
        direccion: query.direccion,
      });
      res.json({ datos: datos.map(busquedaJson), paginacion });
    }),

    obtenerProductoTienda: manejar({ params: paramsIdProductoSchema }, async ({ params }, res) => {
      res.json({ datos: productoTiendaJson(await servicio.obtenerProductoTienda(params.id)) });
    }),

    listarProductosAdmin: manejar({ query: listarProductosSchema }, async ({ query }, res) => {
      res.json(
        await servicio.listarProductosAdmin({
          pagina: query.pagina,
          tamano: query.tamano,
          idCategoria: query.categoria ?? null,
          activo: query.activo ?? null,
          texto: query.texto ?? null,
          orden: query.orden,
          direccion: query.direccion,
        }),
      );
    }),

    obtenerProductoAdmin: manejar({ params: paramsIdProductoSchema }, async ({ params }, res) => {
      res.json({ datos: productoAdminJson(await servicio.obtenerProductoAdmin(params.id)) });
    }),

    crearProducto: manejar({ body: crearProductoSchema }, async ({ body }, res) => {
      res
        .status(HTTP_CREADO)
        .json({ datos: productoAdminJson(await servicio.crearProducto(body)) });
    }),

    actualizarProducto: manejar(
      { params: paramsIdProductoSchema, body: actualizarProductoSchema },
      async ({ params, body }, res) => {
        res.json({ datos: productoAdminJson(await servicio.actualizarProducto(params.id, body)) });
      },
    ),

    activarProducto: manejar({ params: paramsIdProductoSchema }, async ({ params }, res) => {
      res.json({ datos: productoAdminJson(await servicio.activarProducto(params.id)) });
    }),

    desactivarProducto: manejar({ params: paramsIdProductoSchema }, async ({ params }, res) => {
      res.json({ datos: productoAdminJson(await servicio.desactivarProducto(params.id)) });
    }),

    eliminarProducto: manejar({ params: paramsIdProductoSchema }, async ({ params }, res) => {
      await servicio.eliminarProducto(params.id);
      res.status(HTTP_SIN_CONTENIDO).end();
    }),

    guardarImagenes: manejar(
      { params: paramsIdProductoSchema, body: guardarImagenesSchema },
      async ({ params, body }, res) => {
        res.json({ datos: productoAdminJson(await servicio.guardarImagenes(params.id, body)) });
      },
    ),

    crearVariante: manejar(
      { params: paramsIdProductoSchema, body: crearVarianteSchema },
      async ({ params, body }, res) => {
        const producto = await servicio.crearVariante(params.id, body);
        res.status(HTTP_CREADO).json({ datos: productoAdminJson(producto) });
      },
    ),

    actualizarVariante: manejar(
      { params: paramsIdVarianteSchema, body: actualizarVarianteSchema },
      async ({ params, body }, res) => {
        res.json({ datos: productoAdminJson(await servicio.actualizarVariante(params.id, body)) });
      },
    ),

    activarVariante: manejar({ params: paramsIdVarianteSchema }, async ({ params }, res) => {
      res.json({ datos: productoAdminJson(await servicio.activarVariante(params.id)) });
    }),

    desactivarVariante: manejar({ params: paramsIdVarianteSchema }, async ({ params }, res) => {
      res.json({ datos: productoAdminJson(await servicio.desactivarVariante(params.id)) });
    }),

    eliminarVariante: manejar({ params: paramsIdVarianteSchema }, async ({ params }, res) => {
      await servicio.eliminarVariante(params.id);
      res.status(HTTP_SIN_CONTENIDO).end();
    }),

    historialPrecios: manejar({ params: paramsIdVarianteSchema }, async ({ params }, res) => {
      res.json({ datos: versionesJson(await servicio.historialPrecios(params.id)) });
    }),

    cambiarPrecio: manejar(
      { params: paramsIdVarianteSchema, body: cambiarPrecioSchema },
      async ({ params, body }, res) => {
        res.json({ datos: versionesJson(await servicio.cambiarPrecio(params.id, body)) });
      },
    ),
  };
}
