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
import type { Usuario } from './usuarios.types.js';

const HTTP_CREADO = 201;

const usuarioARespuesta = (usuario: Usuario) => ({
  ...usuario,
  fechaCreacion: usuario.fechaCreacion.toISOString(),
});

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
      res.json({ datos: usuarioARespuesta(await servicio.obtenerPerfil()) });
    }),

    actualizarPerfil: manejar({ body: actualizarPerfilSchema }, async ({ body }, res) => {
      res.json({ datos: usuarioARespuesta(await servicio.actualizarPerfil(body)) });
    }),

    cambiarContrasena: manejar(
      { body: cambiarContrasenaSchema },
      async ({ body, cliente }, res) => {
        enviarSesion(res, await servicio.cambiarContrasena(body, cliente));
      },
    ),

    listar: manejar({ query: listarUsuariosSchema }, async ({ query }, res) => {
      const pagina = await servicio.listar({
        pagina: query.pagina,
        tamano: query.tamano,
        rol: query.rol ?? null,
        activo: query.activo ?? null,
        orden: query.orden,
        direccion: query.direccion,
      });
      res.json({ ...pagina, datos: pagina.datos.map(usuarioARespuesta) });
    }),

    crearInterno: manejar({ body: crearInternoSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: usuarioARespuesta(await servicio.crearInterno(body)) });
    }),

    actualizar: manejar(
      { params: paramsIdUsuarioSchema, body: actualizarUsuarioSchema },
      async ({ params, body }, res) => {
        res.json({ datos: usuarioARespuesta(await servicio.actualizar(params.id, body)) });
      },
    ),

    desactivar: manejar({ params: paramsIdUsuarioSchema }, async ({ params }, res) => {
      res.json({ datos: usuarioARespuesta(await servicio.desactivar(params.id)) });
    }),

    activar: manejar({ params: paramsIdUsuarioSchema }, async ({ params }, res) => {
      res.json({ datos: usuarioARespuesta(await servicio.activar(params.id)) });
    }),
  };
}
