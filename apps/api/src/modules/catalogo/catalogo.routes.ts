import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CatalogoController } from './catalogo.controller.js';
import {
  actualizarCategoriaSchema,
  categoriaPublicaSchema,
  categoriaSchema,
  crearCategoriaSchema,
  paramsIdCategoriaSchema,
} from './catalogo.schemas.js';

const RUTA_CATEGORIAS = '/api/v1/categorias';
const RUTA_ADMIN_CATEGORIAS = '/api/v1/admin/categorias';
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
  return router;
}
