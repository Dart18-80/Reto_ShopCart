import { Router } from 'express';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import type { SistemaController } from './sistema.controller.js';
import { respuestaSaludSchema } from './sistema.schemas.js';

// Se registra al cargar el módulo, una sola vez, aunque se cree más de una app.
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/health',
  tags: ['Sistema'],
  summary: 'Estado de la réplica, de SQL Server y de Redis',
  description:
    'Pública: la usan el healthcheck de Docker y nginx. Solo devuelve estados; la versión y la ' +
    'hora de SQL Server van al log.',
  responses: {
    200: {
      description: 'La réplica atiende. `redis: "degradado"` si Redis no responde.',
      content: { 'application/json': { schema: respuestaSaludSchema } },
    },
    503: {
      description: 'La base de datos no responde: la réplica sale de la rotación.',
      content: { 'application/json': { schema: respuestaSaludSchema } },
    },
    ...respuestasError(500),
  },
});

export function crearSistemaRouter(controller: SistemaController): Router {
  const router = Router();
  // Pública a propósito: la usan el healthcheck de Docker y nginx, sin token. No expone datos de negocio.
  router.get('/health', controller.health);
  return router;
}
