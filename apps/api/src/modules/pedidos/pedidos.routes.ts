import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import {
  registroOpenApi,
  respuestaPaginadaSchema,
  respuestasError,
} from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { PedidosController } from './pedidos.controller.js';
import {
  cancelacionSchema,
  devolucionRegistradaSchema,
  pedidoSchema,
  reembolsoSchema,
  resumenPedidoGestionSchema,
  resumenPedidoSchema,
} from './pedidos.respuesta.js';
import { ESTADOS_REEMBOLSO } from './pedidos.types.js';
import {
  cambiarEstadoSchema,
  cancelarPedidoSchema,
  listarReembolsosSchema,
  paramsIdReembolsoSchema,
  listarPedidosGestionSchema,
  listarPedidosPropiosSchema,
  paramsIdPedidoSchema,
  registrarDevolucionSchema,
} from './pedidos.schemas.js';

const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const pagina = (schema: z.ZodType) => json(respuestaPaginadaSchema(schema));

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

const respuestaCancelacion = {
  200: {
    description:
      'Pedido cancelado; el reembolso queda Completado o, si la pasarela falló, Pendiente para el job',
    ...json(z.object({ datos: cancelacionSchema })),
  },
  ...respuestasError(400, 401, 403, 404, 409),
};
const resumenCancelar =
  'Cancela el pedido completo (solo Pagado o EnPreparacion, motivo obligatorio): reingreso al inventario, cupón revertido y reembolso del total con envío (N-09)';

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/pedidos/{id}/cancelar',
  tags: ['Pedidos'],
  summary: resumenCancelar,
  security: seguridad,
  request: { params: paramsIdPedidoSchema, body: json(cancelarPedidoSchema) },
  responses: respuestaCancelacion,
});
registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/admin/pedidos/{id}/cancelar',
  tags: ['Pedidos'],
  summary: `${resumenCancelar}, desde la gestión`,
  security: seguridad,
  request: { params: paramsIdPedidoSchema, body: json(cancelarPedidoSchema) },
  responses: respuestaCancelacion,
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/admin/reembolsos',
  tags: ['Pedidos'],
  summary:
    'Reembolsos (los más recientes primero); estado=Fallido es la lista para resolver a mano',
  security: seguridad,
  request: { query: listarReembolsosSchema },
  responses: {
    200: { description: 'Página de reembolsos', ...pagina(reembolsoSchema) },
    ...respuestasError(400, 401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/admin/reembolsos/{id}/reintentar',
  tags: ['Pedidos'],
  summary:
    'Vuelve a Pendiente un reembolso Fallido y lo procesa con la misma llave (nunca reembolsa dos veces)',
  security: seguridad,
  request: { params: paramsIdReembolsoSchema },
  responses: {
    200: {
      description: 'El estado del reembolso después del reintento',
      ...json(
        z.object({
          datos: z.object({ idReembolso: z.number().int(), estado: z.enum(ESTADOS_REEMBOLSO) }),
        }),
      ),
    },
    ...respuestasError(400, 401, 403, 404),
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/admin/pedidos/{id}/devoluciones',
  tags: ['Pedidos'],
  summary:
    'Registra una devolución por línea (Entregado o DevueltoParcial, dentro de 30 días): reingreso al inventario, estado derivado y reembolso proporcional sin envío (N-10)',
  security: seguridad,
  request: { params: paramsIdPedidoSchema, body: json(registrarDevolucionSchema) },
  responses: {
    201: {
      description: 'Devolución registrada; el reembolso queda Completado o Pendiente para el job',
      ...json(z.object({ datos: devolucionRegistradaSchema })),
    },
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});

export function crearPedidosRouter(
  controller: PedidosController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloCliente = [autenticar, autorizar('Cliente')];
  const gestion = [autenticar, autorizar('Operador', 'Administrador')];
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.get('/pedidos', ...soloCliente, controller.listarPropios);
  router.get('/pedidos/:id', ...soloCliente, controller.obtenerPropio);
  router.get('/admin/pedidos', ...gestion, controller.listarGestion);
  router.post('/admin/pedidos/:id/estado', ...gestion, controller.cambiarEstado);
  router.post('/pedidos/:id/cancelar', ...soloCliente, controller.cancelar);
  router.post('/admin/pedidos/:id/cancelar', ...gestion, controller.cancelar);
  router.post('/admin/pedidos/:id/devoluciones', ...gestion, controller.registrarDevolucion);
  router.get('/admin/reembolsos', ...soloAdmin, controller.listarReembolsos);
  router.post('/admin/reembolsos/:id/reintentar', ...soloAdmin, controller.reintentarReembolso);
  return router;
}
