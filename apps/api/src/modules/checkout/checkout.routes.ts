import { Router, type RequestHandler } from 'express';
import { autorizar, encabezadoIdempotenciaSchema } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CheckoutController } from './checkout.controller.js';
import { pedidoSchema } from '../pedidos/index.js';
import { iniciarSesionSchema, pagarSchema, sesionPagoSchema } from './checkout.schemas.js';

const RUTA = '/api/v1/checkout/sesion';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuestaSesion = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: sesionPagoSchema })),
});

registroOpenApi.registerPath({
  method: 'post',
  path: RUTA,
  tags: ['Checkout'],
  summary:
    'Inicia el pago: reserva todo o nada por MinutosReserva y congela precios, descuento y envío (01 §6.1)',
  security: seguridad,
  request: { body: json(iniciarSesionSchema) },
  responses: {
    200: respuestaSesion('El carrito no cambió: la misma sesión Activa'),
    201: respuestaSesion('Sesión creada (la anterior, si había, se canceló y liberó)'),
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Checkout'],
  summary: 'La sesión de pago Activa del cliente',
  security: seguridad,
  responses: { 200: respuestaSesion('Sesión Activa'), ...respuestasError(401, 403, 404) },
});
registroOpenApi.registerPath({
  method: 'delete',
  path: RUTA,
  tags: ['Checkout'],
  summary: 'Cancela la sesión de pago y libera reservas y cupón (no si hay un pago en curso)',
  security: seguridad,
  responses: {
    204: { description: 'Sesión cancelada' },
    ...respuestasError(401, 403, 404, 409),
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/pagos`,
  tags: ['Checkout'],
  summary:
    'Paga la sesión: autoriza, crea el pedido (atómico) y captura. Idempotency-Key obligatoria: la misma llave da el mismo resultado (01 §6.2)',
  security: seguridad,
  request: {
    headers: encabezadoIdempotenciaSchema,
    body: json(pagarSchema),
  },
  responses: {
    200: {
      description: 'Ya pagado: el pedido existente',
      ...json(z.object({ datos: pedidoSchema })),
    },
    201: { description: 'Pedido creado', ...json(z.object({ datos: pedidoSchema })) },
    ...respuestasError(400, 401, 402, 403, 404, 409, 422, 504),
  },
});

export function crearCheckoutRouter(
  controller: CheckoutController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  // N-05: el checkout exige sesión; solo el Cliente compra.
  const soloCliente = [autenticar, autorizar('Cliente')];

  router.post('/checkout/sesion', ...soloCliente, controller.iniciarSesion);
  router.get('/checkout/sesion', ...soloCliente, controller.obtenerSesion);
  router.delete('/checkout/sesion', ...soloCliente, controller.cancelarSesion);
  router.post('/checkout/sesion/pagos', ...soloCliente, controller.pagar);
  return router;
}
