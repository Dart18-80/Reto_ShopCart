import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CatalogoController } from './catalogo.controller.js';
import {
  actualizarCategoriaSchema,
  atributoSchema,
  categoriaPublicaSchema,
  categoriaSchema,
  crearAtributoSchema,
  crearCategoriaSchema,
  crearValorAtributoSchema,
  paramsIdAtributoSchema,
  paramsIdCategoriaSchema,
  valorAtributoCreadoSchema,
} from './catalogo.schemas.js';

const RUTA_CATEGORIAS = '/api/v1/categorias';
const RUTA_ADMIN_CATEGORIAS = '/api/v1/admin/categorias';
const RUTA_ADMIN_ATRIBUTOS = '/api/v1/admin/atributos';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuestaCategoria = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: categoriaSchema })),
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA_CATEGORIAS,
  tags: ['Catálogo'],
  summary: 'Categorías activas de la tienda (público)',
  responses: {
    200: {
      description: 'Categorías',
      ...json(z.object({ datos: z.array(categoriaPublicaSchema) })),
    },
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: RUTA_ADMIN_CATEGORIAS,
  tags: ['Catálogo'],
  summary: 'Crea una categoría (Admin; nombre único sin distinguir mayúsculas)',
  security: seguridad,
  request: { body: json(crearCategoriaSchema) },
  responses: {
    201: respuestaCategoria('Categoría creada'),
    ...respuestasError(400, 401, 403, 409),
  },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA_ADMIN_CATEGORIAS}/{id}`,
  tags: ['Catálogo'],
  summary: 'Edita una categoría (Admin; descripcion en null se quita)',
  security: seguridad,
  request: { params: paramsIdCategoriaSchema, body: json(actualizarCategoriaSchema) },
  responses: {
    200: respuestaCategoria('Categoría actualizada'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA_ADMIN_CATEGORIAS}/{id}/activar`,
  tags: ['Catálogo'],
  summary: 'Activa una categoría (Admin)',
  security: seguridad,
  request: { params: paramsIdCategoriaSchema },
  responses: {
    200: respuestaCategoria('Categoría activa'),
    ...respuestasError(400, 401, 403, 404),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA_ADMIN_CATEGORIAS}/{id}/desactivar`,
  tags: ['Catálogo'],
  summary: 'Desactiva una categoría sin productos activos (Admin; N-14)',
  security: seguridad,
  request: { params: paramsIdCategoriaSchema },
  responses: {
    200: respuestaCategoria('Categoría inactiva'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
registroOpenApi.registerPath({
  method: 'delete',
  path: `${RUTA_ADMIN_CATEGORIAS}/{id}`,
  tags: ['Catálogo'],
  summary: 'Borra una categoría sin productos (Admin; N-14)',
  security: seguridad,
  request: { params: paramsIdCategoriaSchema },
  responses: {
    204: { description: 'Categoría borrada' },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA_ADMIN_ATRIBUTOS,
  tags: ['Catálogo'],
  summary: 'Atributos con sus valores, en orden (Admin)',
  security: seguridad,
  responses: {
    200: { description: 'Atributos', ...json(z.object({ datos: z.array(atributoSchema) })) },
    ...respuestasError(401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: RUTA_ADMIN_ATRIBUTOS,
  tags: ['Catálogo'],
  summary: 'Crea un atributo (Admin; nombre único; sin orden va al final)',
  security: seguridad,
  request: { body: json(crearAtributoSchema) },
  responses: {
    201: { description: 'Atributo creado', ...json(z.object({ datos: atributoSchema })) },
    ...respuestasError(400, 401, 403, 409),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA_ADMIN_ATRIBUTOS}/{id}/valores`,
  tags: ['Catálogo'],
  summary:
    'Agrega un valor a un atributo (Admin; único dentro del atributo; sin orden va al final)',
  security: seguridad,
  request: { params: paramsIdAtributoSchema, body: json(crearValorAtributoSchema) },
  responses: {
    201: { description: 'Valor creado', ...json(z.object({ datos: valorAtributoCreadoSchema })) },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

export function crearCatalogoRouter(
  controller: CatalogoController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  // Pública: la tienda muestra las categorías activas a cualquier visitante (RF-02).
  router.get('/categorias', controller.listarCategorias);

  router.post('/admin/categorias', ...soloAdmin, controller.crearCategoria);
  router.patch('/admin/categorias/:id', ...soloAdmin, controller.actualizarCategoria);
  router.post('/admin/categorias/:id/activar', ...soloAdmin, controller.activarCategoria);
  router.post('/admin/categorias/:id/desactivar', ...soloAdmin, controller.desactivarCategoria);
  router.delete('/admin/categorias/:id', ...soloAdmin, controller.eliminarCategoria);

  router.get('/admin/atributos', ...soloAdmin, controller.listarAtributos);
  router.post('/admin/atributos', ...soloAdmin, controller.crearAtributo);
  router.post('/admin/atributos/:id/valores', ...soloAdmin, controller.crearValorAtributo);
  return router;
}
