import { Router, type RequestHandler } from 'express';
import { autenticarOpcional, autorizarSiHaySesion } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { CarritoController } from './carrito.controller.js';
import {
  actualizarCantidadSchema,
  agregarLineaSchema,
  carritoSchema,
  paramsIdLineaSchema,
} from './carrito.schemas.js';

const RUTA = '/api/v1/carrito';
// Con sesión de Cliente, Bearer; sin sesión, la cookie httpOnly carrito_invitado (N-05).
const seguridad: Record<string, string[]>[] = [{ bearer: [] }, {}];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuestaCarrito = (descripcion: string) => ({
  description: `${descripcion}. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1).`,
  ...json(z.object({ datos: carritoSchema })),
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Carrito'],
  summary: 'El carrito del cliente o del invitado, con el estado de cada línea (vacío si no hay)',
  security: seguridad,
  responses: { 200: respuestaCarrito('Carrito'), ...respuestasError(401, 403) },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/lineas`,
  tags: ['Carrito'],
  summary:
    'Agrega una variante o suma la cantidad si ya está (N-06). Un invitado sin carrito recibe la cookie al crearlo (20 por minuto por IP)',
  security: seguridad,
  request: { body: json(agregarLineaSchema) },
  responses: {
    200: respuestaCarrito('Carrito actualizado'),
    ...respuestasError(400, 401, 403, 404, 409, 422, 429),
  },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA}/lineas/{idLinea}`,
  tags: ['Carrito'],
  summary:
    'Cambia la cantidad de una línea (para quitarla, DELETE); una NoDisponible solo se elimina',
  security: seguridad,
  request: { params: paramsIdLineaSchema, body: json(actualizarCantidadSchema) },
  responses: {
    200: respuestaCarrito('Carrito actualizado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
registroOpenApi.registerPath({
  method: 'delete',
  path: `${RUTA}/lineas/{idLinea}`,
  tags: ['Carrito'],
  summary: 'Quita una línea del carrito (una de otro carrito responde 404, RF-01)',
  security: seguridad,
  request: { params: paramsIdLineaSchema },
  responses: { 200: respuestaCarrito('Carrito actualizado'), ...respuestasError(401, 403, 404) },
});

registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/avisos/vistos`,
  tags: ['Carrito'],
  summary: 'Marca como vistas las alertas "El precio cambió de Q… a Q…" (N-02)',
  security: seguridad,
  responses: {
    200: respuestaCarrito('Carrito sin alertas pendientes'),
    ...respuestasError(401, 403),
  },
});

export function crearCarritoRouter(
  controller: CarritoController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  // N-05: Cliente o invitado; Operador y Admin reciben 403.
  const clienteOInvitado = [autenticarOpcional(autenticar), autorizarSiHaySesion('Cliente')];

  router.get('/carrito', ...clienteOInvitado, controller.obtener);
  router.post('/carrito/lineas', ...clienteOInvitado, controller.agregarLinea);
  router.patch('/carrito/lineas/:idLinea', ...clienteOInvitado, controller.actualizarCantidad);
  router.delete('/carrito/lineas/:idLinea', ...clienteOInvitado, controller.eliminarLinea);
  router.post('/carrito/avisos/vistos', ...clienteOInvitado, controller.marcarAvisosVistos);
  return router;
}
