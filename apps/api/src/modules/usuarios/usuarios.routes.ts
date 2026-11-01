import { Router, type RequestHandler } from 'express';
import {
  autorizar,
  consultaPaginacionSchema,
  limitarIntentos,
  obtenerContexto,
  type LimitadorIntentos,
} from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { UsuariosController } from './usuarios.controller.js';
import {
  actualizarPerfilSchema,
  actualizarUsuarioSchema,
  cambiarContrasenaSchema,
  crearInternoSchema,
  paramsIdUsuarioSchema,
  usuarioSchema,
} from './usuarios.schemas.js';

const RUTA = '/api/v1/usuarios';
const respuestaUsuario = (descripcion: string) => ({
  description: descripcion,
  content: { 'application/json': { schema: z.object({ datos: usuarioSchema }) } },
});
const cuerpo = (schema: z.ZodType) => ({ body: { content: { 'application/json': { schema } } } });
const seguridad = [{ bearer: [] }];

registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/me`,
  tags: ['Usuarios'],
  summary: 'Perfil del usuario de la sesión',
  security: seguridad,
  responses: { 200: respuestaUsuario('Perfil'), ...respuestasError(401) },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA}/me`,
  tags: ['Usuarios'],
  summary: 'Edita el nombre y el teléfono propios (telefono: null lo quita)',
  security: seguridad,
  request: cuerpo(actualizarPerfilSchema),
  responses: { 200: respuestaUsuario('Perfil actualizado'), ...respuestasError(400, 401) },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/me/contrasena`,
  tags: ['Usuarios'],
  summary:
    'Cambia la contraseña: corta las otras sesiones y renueva esta (5 intentos por minuto por usuario)',
  security: seguridad,
  request: cuerpo(cambiarContrasenaSchema),
  responses: {
    200: { description: 'Sesión nueva; el refresh token llega en la cookie "refresh"' },
    ...respuestasError(400, 401, 429),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Usuarios'],
  summary: 'Listado paginado de usuarios (Admin), con filtro por rol y estado',
  security: seguridad,
  request: {
    query: consultaPaginacionSchema.extend({
      rol: z.string().optional(),
      activo: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Página de usuarios',
      content: {
        'application/json': {
          schema: z.object({
            datos: z.array(usuarioSchema),
            paginacion: z.object({
              pagina: z.number(),
              tamano: z.number(),
              total: z.number(),
              totalPaginas: z.number(),
            }),
          }),
        },
      },
    },
    ...respuestasError(400, 401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: RUTA,
  tags: ['Usuarios'],
  summary: 'Crea un Operador o un Admin con una contraseña inicial (N-15)',
  security: seguridad,
  request: cuerpo(crearInternoSchema),
  responses: { 201: respuestaUsuario('Usuario creado'), ...respuestasError(400, 401, 403, 409) },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA}/{id}`,
  tags: ['Usuarios'],
  summary: 'Edita el nombre o el rol de un usuario (Admin)',
  security: seguridad,
  request: { params: paramsIdUsuarioSchema, ...cuerpo(actualizarUsuarioSchema) },
  responses: {
    200: respuestaUsuario('Usuario actualizado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
for (const accion of ['desactivar', 'activar'] as const) {
  registroOpenApi.registerPath({
    method: 'post',
    path: `${RUTA}/{id}/${accion}`,
    tags: ['Usuarios'],
    summary:
      accion === 'desactivar'
        ? 'Desactiva un usuario: revoca sus sesiones y su access token deja de servir (N-15)'
        : 'Activa un usuario',
    security: seguridad,
    request: { params: paramsIdUsuarioSchema },
    responses: { 200: respuestaUsuario('Usuario'), ...respuestasError(401, 403, 404, 409) },
  });
}

// Va después de autenticar: el usuario ya está en el contexto.
const porUsuario = (): string => String(obtenerContexto()?.idUsuario);

export function crearUsuariosRouter(
  controller: UsuariosController,
  autenticar: RequestHandler,
  limitadorContrasena: LimitadorIntentos,
): Router {
  const router = Router();
  const cualquierUsuario = [autenticar, autorizar('Cliente', 'Operador', 'Administrador')];
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.get('/me', ...cualquierUsuario, controller.obtenerPerfil);
  router.patch('/me', ...cualquierUsuario, controller.actualizarPerfil);
  // A-07: con un access token robado no se puede adivinar la contraseña actual sin límite.
  router.post(
    '/me/contrasena',
    ...cualquierUsuario,
    limitarIntentos(limitadorContrasena, porUsuario),
    controller.cambiarContrasena,
  );

  router.get('/', ...soloAdmin, controller.listar);
  router.post('/', ...soloAdmin, controller.crearInterno);
  router.patch('/:id', ...soloAdmin, controller.actualizar);
  router.post('/:id/desactivar', ...soloAdmin, controller.desactivar);
  router.post('/:id/activar', ...soloAdmin, controller.activar);
  return router;
}
