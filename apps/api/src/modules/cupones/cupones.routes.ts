import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CuponesController } from './cupones.controller.js';
import {
  actualizarCuponSchema,
  crearCuponSchema,
  cuponSchema,
  listarCuponesSchema,
  paramsIdCuponSchema,
} from './cupones.schemas.js';

const RUTA = '/api/v1/admin/cupones';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuestaCupon = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: cuponSchema })),
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Cupones'],
  summary: 'Cupones (los más recientes primero), opcionalmente por estado',
  security: seguridad,
  request: { query: listarCuponesSchema },
  responses: {
    200: {
      description: 'Página de cupones',
      ...json(
        z.object({
          datos: z.array(cuponSchema),
          paginacion: z.object({
            pagina: z.number().int(),
            tamano: z.number().int(),
            total: z.number().int(),
            totalPaginas: z.number().int(),
          }),
        }),
      ),
    },
    ...respuestasError(400, 401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: RUTA,
  tags: ['Cupones'],
  summary: 'Crea un cupón (código en mayúsculas, único sin distinguir mayúsculas)',
  security: seguridad,
  request: { body: json(crearCuponSchema) },
  responses: { 201: respuestaCupon('Cupón creado'), ...respuestasError(400, 401, 403, 404, 409) },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/{id}`,
  tags: ['Cupones'],
  summary: 'Un cupón',
  security: seguridad,
  request: { params: paramsIdCuponSchema },
  responses: { 200: respuestaCupon('Cupón'), ...respuestasError(401, 403, 404) },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA}/{id}`,
  tags: ['Cupones'],
  summary:
    'Edita un cupón: con usos no cambia tipo ni valor (409); el límite total no baja de los usos comprometidos (422)',
  security: seguridad,
  request: { params: paramsIdCuponSchema, body: json(actualizarCuponSchema) },
  responses: {
    200: respuestaCupon('Cupón actualizado'),
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});
for (const [accion, resumen] of [
  ['activar', 'Activa un cupón (idempotente)'],
  ['desactivar', 'Desactiva un cupón (idempotente)'],
] as const) {
  registroOpenApi.registerPath({
    method: 'post',
    path: `${RUTA}/{id}/${accion}`,
    tags: ['Cupones'],
    summary: resumen,
    security: seguridad,
    request: { params: paramsIdCuponSchema },
    responses: { 200: respuestaCupon('Cupón'), ...respuestasError(401, 403, 404) },
  });
}

export function crearCuponesRouter(
  controller: CuponesController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.get('/admin/cupones', ...soloAdmin, controller.listar);
  router.post('/admin/cupones', ...soloAdmin, controller.crear);
  router.get('/admin/cupones/:id', ...soloAdmin, controller.obtener);
  router.patch('/admin/cupones/:id', ...soloAdmin, controller.actualizar);
  router.post('/admin/cupones/:id/activar', ...soloAdmin, controller.activar);
  router.post('/admin/cupones/:id/desactivar', ...soloAdmin, controller.desactivar);
  return router;
}
