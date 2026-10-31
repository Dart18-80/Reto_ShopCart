import { Router, type Request } from 'express';
import { limitarIntentos, type LimitadorIntentos } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import type { AuthController } from './auth.controller.js';
import { loginSchema, registroSchema, respuestaSesionSchema } from './auth.schemas.js';

export interface LimitadoresAuth {
  /** A-07: 5 intentos por minuto por IP y correo. */
  login: LimitadorIntentos;
  /** A-07: 3 registros por minuto por IP. */
  registro: LimitadorIntentos;
}

const SIN_IP = 'sin-ip';

const porIp = (req: Request): string => req.ip ?? SIN_IP;

// El cuerpo todavía no está validado (manejar corre después): solo se lee el correo si es texto.
function porIpYCorreo(req: Request): string {
  const cuerpo: unknown = req.body;
  const correo =
    typeof cuerpo === 'object' &&
    cuerpo !== null &&
    'correo' in cuerpo &&
    typeof cuerpo.correo === 'string'
      ? cuerpo.correo.trim().toLowerCase()
      : '';
  return `${porIp(req)}|${correo}`;
}

const respuestaSesion = (descripcion: string) => ({
  description: `${descripcion}. El refresh token llega en la cookie httpOnly "refresh" (Path=/api/v1/auth).`,
  content: { 'application/json': { schema: respuestaSesionSchema } },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/auth/registro',
  tags: ['Auth'],
  summary: 'Registro de un cliente (N-15: el registro público solo crea Clientes)',
  request: { body: { content: { 'application/json': { schema: registroSchema } } } },
  responses: {
    201: respuestaSesion('Cliente creado con la sesión abierta'),
    ...respuestasError(400, 409, 429),
  },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Inicio de sesión (mensaje genérico ante credenciales incorrectas)',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: { 200: respuestaSesion('Sesión abierta'), ...respuestasError(400, 401, 429) },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Auth'],
  summary: 'Rota el refresh token de la cookie y emite otro access token (A-07)',
  description: 'Reusar un refresh ya rotado revoca toda la sesión: 401 REFRESH_REUTILIZADO.',
  responses: { 200: respuestaSesion('Sesión renovada'), ...respuestasError(401) },
});

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Cierra la sesión: revoca el refresh token de la cookie y la borra',
  responses: { 204: { description: 'Sesión cerrada (también si no había cookie)' } },
});

export function crearAuthRouter(controller: AuthController, limitadores: LimitadoresAuth): Router {
  const router = Router();
  // Públicas: no hay sesión todavía. Las protege el rate limiting (A-07).
  router.post('/registro', limitarIntentos(limitadores.registro, porIp), controller.registro);
  router.post('/login', limitarIntentos(limitadores.login, porIpYCorreo), controller.login);
  // Sin access token: la prueba de la sesión es el refresh token de la cookie (A-07).
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  return router;
}
