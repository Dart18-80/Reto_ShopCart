import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import { enviarSesion } from '../auth/index.js';
import {
  actualizarPerfilSchema,
  actualizarUsuarioSchema,
  cambiarContrasenaSchema,
  crearInternoSchema,
  listarUsuariosSchema,
  paramsIdUsuarioSchema,
} from './usuarios.schemas.js';
import type { UsuariosService } from './usuarios.service.js';

const HTTP_CREADO = 201;

export interface UsuariosController {
  obtenerPerfil: RequestHandler;
  actualizarPerfil: RequestHandler;
  cambiarContrasena: RequestHandler;
  listar: RequestHandler;
  crearInterno: RequestHandler;
  actualizar: RequestHandler;
  desactivar: RequestHandler;
  activar: RequestHandler;
}

export function crearUsuariosController(servicio: UsuariosService): UsuariosController {
  return {
    obtenerPerfil: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.obtenerPerfil() });
    }),

    actualizarPerfil: manejar({ body: actualizarPerfilSchema }, async ({ body }, res) => {
      res.json({ datos: await servicio.actualizarPerfil(body) });
    }),

    cambiarContrasena: manejar(
      { body: cambiarContrasenaSchema },
      async ({ body, cliente }, res) => {
        enviarSesion(res, await servicio.cambiarContrasena(body, cliente));
      },
    ),

    listar: manejar({ query: listarUsuariosSchema }, async ({ query }, res) => {
      res.json(
        await servicio.listar({
          pagina: query.pagina,
          tamano: query.tamano,
          rol: query.rol ?? null,
          activo: query.activo ?? null,
          orden: query.orden,
          direccion: query.direccion,
        }),
      );
    }),

    crearInterno: manejar({ body: crearInternoSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.crearInterno(body) });
    }),

    actualizar: manejar(
      { params: paramsIdUsuarioSchema, body: actualizarUsuarioSchema },
      async ({ params, body }, res) => {
        res.json({ datos: await servicio.actualizar(params.id, body) });
      },
    ),

    desactivar: manejar({ params: paramsIdUsuarioSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.desactivar(params.id) });
    }),

    activar: manejar({ params: paramsIdUsuarioSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.activar(params.id) });
    }),
  };
}
