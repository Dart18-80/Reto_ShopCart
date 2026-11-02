import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { PedidosController } from './pedidos.controller.js';
import {
  pedidoSchema,
  resumenPedidoGestionSchema,
  resumenPedidoSchema,
} from './pedidos.respuesta.js';
import {
  cambiarEstadoSchema,
  listarPedidosGestionSchema,
  listarPedidosPropiosSchema,
  paramsIdPedidoSchema,
} from './pedidos.schemas.js';

const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const pagina = (schema: z.ZodType) =>
  json(
    z.object({
      datos: z.array(schema),
      paginacion: z.object({
        pagina: z.number().int(),
        tamano: z.number().int(),
        total: z.number().int(),
        totalPaginas: z.number().int(),
      }),
    }),
  );

registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/pedidos',
  tags: ['Pedidos'],
  summary: 'Mis pedidos (los más recientes primero)',
  security: seguridad,
  request: { query: listarPedidosPropiosSchema },
  responses: {
    200: { description: 'Página de pedidos', ...pagina(resumenPedidoSchema) },
    ...respuestasError(400, 401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/pedidos/{id}',
  tags: ['Pedidos'],
  summary: 'Uno de mis pedidos, con su detalle y su historial de estados (uno ajeno responde 404)',
  security: seguridad,
  request: { params: paramsIdPedidoSchema },
  responses: {
    200: { description: 'El pedido', ...json(z.object({ datos: pedidoSchema })) },
    ...respuestasError(400, 401, 403, 404),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/admin/pedidos',
  tags: ['Pedidos'],
  summary:
    'Gestión de pedidos con filtros por estado, cliente y días de Guatemala (FechaPagoLocal), paginada',
  security: seguridad,
  request: { query: listarPedidosGestionSchema },
  responses: {
    200: { description: 'Página de pedidos', ...pagina(resumenPedidoGestionSchema) },
    ...respuestasError(400, 401, 403),
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/admin/pedidos/{id}/estado',
  tags: ['Pedidos'],
  summary:
    'Mueve el pedido por su ciclo (Pagado → EnPreparacion → Despachado → Entregado) si sigue en estadoEsperado (N-08)',
  security: seguridad,
  request: { params: paramsIdPedidoSchema, body: json(cambiarEstadoSchema) },
  responses: {
    200: {
      description: 'El pedido con su nuevo estado',
      ...json(z.object({ datos: pedidoSchema })),
    },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

export function crearPedidosRouter(
  controller: PedidosController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloCliente = [autenticar, autorizar('Cliente')];
  const gestion = [autenticar, autorizar('Operador', 'Administrador')];

  router.get('/pedidos', ...soloCliente, controller.listarPropios);
  router.get('/pedidos/:id', ...soloCliente, controller.obtenerPropio);
  router.get('/admin/pedidos', ...gestion, controller.listarGestion);
  router.post('/admin/pedidos/:id/estado', ...gestion, controller.cambiarEstado);
  return router;
}
