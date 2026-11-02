import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { ConfiguracionController } from './configuracion.controller.js';
import { actualizarConfiguracionSchema, configuracionSchema } from './configuracion.schemas.js';

const RUTA = '/api/v1/admin/configuracion';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuesta = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: configuracionSchema })),
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Configuración'],
  summary: 'Parámetros del sistema (plazos, umbrales y envío gratis)',
  security: seguridad,
  responses: { 200: respuesta('Parámetros'), ...respuestasError(401, 403) },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: RUTA,
  tags: ['Configuración'],
  summary:
    'Cambia parámetros del sistema (montoEnvioGratis en null lo quita); queda en la bitácora',
  security: seguridad,
  request: { body: json(actualizarConfiguracionSchema) },
  responses: { 200: respuesta('Parámetros actualizados'), ...respuestasError(400, 401, 403) },
});

export function crearConfiguracionRouter(
  controller: ConfiguracionController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.get('/admin/configuracion', ...soloAdmin, controller.obtener);
  router.patch('/admin/configuracion', ...soloAdmin, controller.actualizar);
  return router;
}
