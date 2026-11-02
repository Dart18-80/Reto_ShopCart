import type { RequestHandler, Router } from 'express';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { LimitadorIntentos, VersionesSesion } from '../../shared/http/index.js';
import type { Sesiones } from '../auth/index.js';
import { crearUsuariosController } from './usuarios.controller.js';
import { usuariosRepository } from './usuarios.repository.js';
import { crearUsuariosRouter } from './usuarios.routes.js';
import { crearUsuariosService } from './usuarios.service.js';

interface DependenciasUsuarios {
  autenticar: RequestHandler;
  sesiones: Sesiones;
  versiones: Pick<VersionesSesion, 'publicar'>;
  limitadorContrasena: LimitadorIntentos;
  reportes: InvalidadorReportes;
}

export function crearModuloUsuarios({
  autenticar,
  sesiones,
  versiones,
  limitadorContrasena,
  reportes,
}: DependenciasUsuarios): Router {
  const servicio = crearUsuariosService({
    repositorio: usuariosRepository,
    sesiones,
    versiones,
    reportes,
  });
  return crearUsuariosRouter(crearUsuariosController(servicio), autenticar, limitadorContrasena);
}
