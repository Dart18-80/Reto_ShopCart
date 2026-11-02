import { Router, type RequestHandler } from 'express';
import { autenticarOpcional, autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { EnviosController } from './envios.controller.js';
import {
  actualizarMetodoSchema,
  metodoEnvioSchema,
  metodosParaCarritoSchema,
  paramsIdMetodoSchema,
} from './envios.schemas.js';

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/envios/metodos',
  tags: ['Envíos'],
  summary:
    'Métodos de envío activos con su costo para el carrito actual (N-04: envío gratis sobre el subtotal después del cupón)',
  security: [{ bearer: [] }, {}],
  responses: {
    200: {
      description:
        'Métodos y envío gratis. Un invitado envía su cookie "carrito_invitado"; sin carrito, el monto es 0.',
      ...json(z.object({ datos: metodosParaCarritoSchema })),
    },
    ...respuestasError(401),
  },
});
registroOpenApi.registerPath({
  method: 'put',
  path: '/api/v1/admin/envios/metodos/{id}',
  tags: ['Envíos'],
  summary:
    'Cambia la tarifa, el nombre, los días estimados y el estado de un método (queda en la bitácora)',
  security: [{ bearer: [] }],
  request: { params: paramsIdMetodoSchema, body: json(actualizarMetodoSchema) },
  responses: {
    200: { description: 'Método actualizado', ...json(z.object({ datos: metodoEnvioSchema })) },
    ...respuestasError(400, 401, 403, 404),
  },
});

export function crearEnviosRouter(
  controller: EnviosController,
  autenticar: RequestHandler,
): Router {
  const router = Router();

  // Pública (01 §5.1): sin sesión usa el carrito de la cookie; con un token, lo verifica (inválido → 401).
  router.get('/envios/metodos', autenticarOpcional(autenticar), controller.listarParaCarrito);
  router.put(
    '/admin/envios/metodos/:id',
    autenticar,
    autorizar('Administrador'),
    controller.actualizarMetodo,
  );
  return router;
}
