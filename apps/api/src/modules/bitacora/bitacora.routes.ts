import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { BitacoraController } from './bitacora.controller.js';
import { consultaBitacoraSchema, registroBitacoraSchema } from './bitacora.schemas.js';

registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/bitacora',
  tags: ['Bitácora'],
  summary:
    'Bitácora (lo más reciente primero) con filtros por módulo, entidad y días de Guatemala, paginada en el servidor (RF-09)',
  security: [{ bearer: [] }],
  request: { query: consultaBitacoraSchema },
  responses: {
    200: {
      description: 'Página de la bitácora',
      content: {
        'application/json': {
          schema: z.object({
            datos: z.array(registroBitacoraSchema),
            paginacion: z.object({
              pagina: z.number().int(),
              tamano: z.number().int(),
              total: z.number().int(),
              totalPaginas: z.number().int(),
            }),
          }),
        },
      },
    },
    ...respuestasError(400, 401, 403),
  },
});

export function crearBitacoraRouter(
  controller: BitacoraController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  router.get('/bitacora', autenticar, autorizar('Administrador'), controller.listar);
  return router;
}
