import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CatalogoController } from './catalogo.controller.js';
import {
  actualizarCategoriaSchema,
  actualizarProductoSchema,
  actualizarVarianteSchema,
  atributoSchema,
  cambiarPrecioSchema,
  categoriaPublicaSchema,
  categoriaSchema,
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
  productoAdminSchema,
  productoResumenSchema,
  productoTiendaSchema,
  valorAtributoCreadoSchema,
  versionPrecioSchema,
} from './catalogo.schemas.js';

const V1 = '/api/v1';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const datos = (descripcion: string, schema: z.ZodType) => ({
  description: descripcion,
  ...json(z.object({ datos: schema })),
});
const sinContenido = (descripcion: string) => ({ description: descripcion });

type Metodo = 'get' | 'post' | 'patch' | 'put' | 'delete';
interface RutaAdmin {
  metodo: Metodo;
  ruta: string;
  resumen: string;
  params?: z.ZodObject;
  query?: z.ZodObject;
  cuerpo?: z.ZodType;
  exito: [number, ReturnType<typeof datos> | ReturnType<typeof sinContenido>];
  errores: number[];
}

/** Toda ruta de administración del catálogo es solo de Admin: siempre 401 y 403 además de sus errores. */
function registrarAdmin({
  metodo,
  ruta,
  resumen,
  params,
  query,
  cuerpo,
  exito,
  errores,
}: RutaAdmin) {
  registroOpenApi.registerPath({
    method: metodo,
    path: `${V1}/admin${ruta}`,
    tags: ['Catálogo'],
    summary: `${resumen} (Admin)`,
    security: seguridad,
    request: {
      ...(params === undefined ? {} : { params }),
      ...(query === undefined ? {} : { query }),
      ...(cuerpo === undefined ? {} : { body: json(cuerpo) }),
    },
    responses: { [exito[0]]: exito[1], ...respuestasError(401, 403, ...errores) },
  });
}

// --- Públicas

registroOpenApi.registerPath({
  method: 'get',
  path: `${V1}/categorias`,
  tags: ['Catálogo'],
  summary: 'Categorías activas de la tienda (público)',
  responses: { 200: datos('Categorías', z.array(categoriaPublicaSchema)) },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${V1}/productos/{id}`,
  tags: ['Catálogo'],
  summary:
    'Producto de la tienda (público): variantes activas, precio vigente y estado de existencia (N-06)',
  request: { params: paramsIdProductoSchema },
  responses: { 200: datos('Producto', productoTiendaSchema), ...respuestasError(400, 404) },
});

// --- Categorías (E3-H01)

const categoria = (descripcion: string) => datos(descripcion, categoriaSchema);
registrarAdmin({
  metodo: 'post',
  ruta: '/categorias',
  resumen: 'Crea una categoría; nombre único sin distinguir mayúsculas',
  cuerpo: crearCategoriaSchema,
  exito: [201, categoria('Categoría creada')],
  errores: [400, 409],
});
registrarAdmin({
  metodo: 'patch',
  ruta: '/categorias/{id}',
  resumen: 'Edita una categoría; descripcion en null se quita',
  params: paramsIdCategoriaSchema,
  cuerpo: actualizarCategoriaSchema,
  exito: [200, categoria('Categoría actualizada')],
  errores: [400, 404, 409],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/categorias/{id}/activar',
  resumen: 'Activa una categoría',
  params: paramsIdCategoriaSchema,
  exito: [200, categoria('Categoría activa')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/categorias/{id}/desactivar',
  resumen: 'Desactiva una categoría sin productos activos (N-14)',
  params: paramsIdCategoriaSchema,
  exito: [200, categoria('Categoría inactiva')],
  errores: [400, 404, 409],
});
registrarAdmin({
  metodo: 'delete',
  ruta: '/categorias/{id}',
  resumen: 'Borra una categoría sin productos (N-14)',
  params: paramsIdCategoriaSchema,
  exito: [204, sinContenido('Categoría borrada')],
  errores: [400, 404, 409],
});

// --- Atributos (E3-H02)

registrarAdmin({
  metodo: 'get',
  ruta: '/atributos',
  resumen: 'Atributos con sus valores, en orden',
  exito: [200, datos('Atributos', z.array(atributoSchema))],
  errores: [],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/atributos',
  resumen: 'Crea un atributo; nombre único; sin orden va al final',
  cuerpo: crearAtributoSchema,
  exito: [201, datos('Atributo creado', atributoSchema)],
  errores: [400, 409],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/atributos/{id}/valores',
  resumen: 'Agrega un valor a un atributo; único dentro del atributo; sin orden va al final',
  params: paramsIdAtributoSchema,
  cuerpo: crearValorAtributoSchema,
  exito: [201, datos('Valor creado', valorAtributoCreadoSchema)],
  errores: [400, 404, 409],
});

// --- Productos, imágenes y variantes (E3-H03). Las escrituras devuelven el producto actualizado.

const producto = (descripcion: string) => datos(descripcion, productoAdminSchema);
registrarAdmin({
  metodo: 'get',
  ruta: '/productos',
  resumen: 'Productos paginados, activos o no, con filtros de categoría, estado y texto',
  query: listarProductosSchema,
  exito: [
    200,
    {
      description: 'Productos',
      ...json(
        z.object({
          datos: z.array(productoResumenSchema),
          paginacion: z.object({
            pagina: z.number().int(),
            tamano: z.number().int(),
            total: z.number().int(),
            totalPaginas: z.number().int(),
          }),
        }),
      ),
    },
  ],
  errores: [400],
});
registrarAdmin({
  metodo: 'get',
  ruta: '/productos/{id}',
  resumen: 'Producto con variantes inactivas y existencia exacta',
  params: paramsIdProductoSchema,
  exito: [200, producto('Producto')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/productos',
  resumen: 'Crea un producto; activo solo en una categoría activa (N-14)',
  cuerpo: crearProductoSchema,
  exito: [201, producto('Producto creado')],
  errores: [400, 409],
});
registrarAdmin({
  metodo: 'patch',
  ruta: '/productos/{id}',
  resumen:
    'Edita un producto; descripcion en null se quita; un activo no se mueve a una categoría inactiva',
  params: paramsIdProductoSchema,
  cuerpo: actualizarProductoSchema,
  exito: [200, producto('Producto actualizado')],
  errores: [400, 404, 409],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/productos/{id}/activar',
  resumen: 'Activa un producto; su categoría debe estar activa (N-14)',
  params: paramsIdProductoSchema,
  exito: [200, producto('Producto activo')],
  errores: [400, 404, 409],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/productos/{id}/desactivar',
  resumen: 'Desactiva un producto: deja de mostrarse en la tienda',
  params: paramsIdProductoSchema,
  exito: [200, producto('Producto inactivo')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'delete',
  ruta: '/productos/{id}',
  resumen: 'Borra un producto sin historial (N-14)',
  params: paramsIdProductoSchema,
  exito: [204, sinContenido('Producto borrado')],
  errores: [400, 404, 409],
});
registrarAdmin({
  metodo: 'put',
  ruta: '/productos/{id}/imagenes',
  resumen: 'Reemplaza las imágenes del producto: una sola principal y órdenes únicos (N-19)',
  params: paramsIdProductoSchema,
  cuerpo: guardarImagenesSchema,
  exito: [200, producto('Producto con sus imágenes')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/productos/{id}/variantes',
  resumen:
    'Crea una variante con su precio inicial; mismo conjunto de atributos que las demás (N-14)',
  params: paramsIdProductoSchema,
  cuerpo: crearVarianteSchema,
  exito: [201, producto('Producto con la variante nueva')],
  errores: [400, 404, 409, 422],
});
registrarAdmin({
  metodo: 'patch',
  ruta: '/variantes/{id}',
  resumen: 'Edita el SKU o la combinación; con historial la combinación no cambia (N-14)',
  params: paramsIdVarianteSchema,
  cuerpo: actualizarVarianteSchema,
  exito: [200, producto('Producto actualizado')],
  errores: [400, 404, 409, 422],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/variantes/{id}/activar',
  resumen: 'Activa una variante',
  params: paramsIdVarianteSchema,
  exito: [200, producto('Producto actualizado')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'post',
  ruta: '/variantes/{id}/desactivar',
  resumen: 'Desactiva una variante: deja de mostrarse en la tienda',
  params: paramsIdVarianteSchema,
  exito: [200, producto('Producto actualizado')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'delete',
  ruta: '/variantes/{id}',
  resumen: 'Borra una variante sin historial (N-14)',
  params: paramsIdVarianteSchema,
  exito: [204, sinContenido('Variante borrada')],
  errores: [400, 404, 409],
});

// --- Precios (E3-H04)

const historial = (descripcion: string) =>
  datos(
    `${descripcion}: de la versión más reciente a la más antigua`,
    z.array(versionPrecioSchema),
  );
registrarAdmin({
  metodo: 'get',
  ruta: '/variantes/{id}/precios',
  resumen: 'Historial de precios de una variante',
  params: paramsIdVarianteSchema,
  exito: [200, historial('Historial')],
  errores: [400, 404],
});
registrarAdmin({
  metodo: 'put',
  ruta: '/variantes/{id}/precio',
  resumen:
    'Cambia el precio: cierra la versión vigente e inserta la nueva en una transacción (N-02)',
  params: paramsIdVarianteSchema,
  cuerpo: cambiarPrecioSchema,
  exito: [200, historial('Historial con la versión nueva')],
  errores: [400, 404],
});

export function crearCatalogoRouter(
  controller: CatalogoController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  // Públicas: la tienda muestra categorías y productos a cualquier visitante (RF-02).
  router.get('/categorias', controller.listarCategorias);
  router.get('/productos/:id', controller.obtenerProductoTienda);

  router.post('/admin/categorias', ...soloAdmin, controller.crearCategoria);
  router.patch('/admin/categorias/:id', ...soloAdmin, controller.actualizarCategoria);
  router.post('/admin/categorias/:id/activar', ...soloAdmin, controller.activarCategoria);
  router.post('/admin/categorias/:id/desactivar', ...soloAdmin, controller.desactivarCategoria);
  router.delete('/admin/categorias/:id', ...soloAdmin, controller.eliminarCategoria);

  router.get('/admin/atributos', ...soloAdmin, controller.listarAtributos);
  router.post('/admin/atributos', ...soloAdmin, controller.crearAtributo);
  router.post('/admin/atributos/:id/valores', ...soloAdmin, controller.crearValorAtributo);

  router.get('/admin/productos', ...soloAdmin, controller.listarProductosAdmin);
  router.get('/admin/productos/:id', ...soloAdmin, controller.obtenerProductoAdmin);
  router.post('/admin/productos', ...soloAdmin, controller.crearProducto);
  router.patch('/admin/productos/:id', ...soloAdmin, controller.actualizarProducto);
  router.post('/admin/productos/:id/activar', ...soloAdmin, controller.activarProducto);
  router.post('/admin/productos/:id/desactivar', ...soloAdmin, controller.desactivarProducto);
  router.delete('/admin/productos/:id', ...soloAdmin, controller.eliminarProducto);
  router.put('/admin/productos/:id/imagenes', ...soloAdmin, controller.guardarImagenes);
  router.post('/admin/productos/:id/variantes', ...soloAdmin, controller.crearVariante);

  router.patch('/admin/variantes/:id', ...soloAdmin, controller.actualizarVariante);
  router.post('/admin/variantes/:id/activar', ...soloAdmin, controller.activarVariante);
  router.post('/admin/variantes/:id/desactivar', ...soloAdmin, controller.desactivarVariante);
  router.delete('/admin/variantes/:id', ...soloAdmin, controller.eliminarVariante);
  router.get('/admin/variantes/:id/precios', ...soloAdmin, controller.historialPrecios);
  router.put('/admin/variantes/:id/precio', ...soloAdmin, controller.cambiarPrecio);
  return router;
}
