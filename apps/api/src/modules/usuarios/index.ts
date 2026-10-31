import type { RequestHandler, Router } from 'express';
import type { ListaRevocados } from '../../shared/http/index.js';
import type { Sesiones } from '../auth/index.js';
import { crearUsuariosController } from './usuarios.controller.js';
import { usuariosRepository } from './usuarios.repository.js';
import { crearUsuariosRouter } from './usuarios.routes.js';
import { crearUsuariosService } from './usuarios.service.js';

interface DependenciasUsuarios {
  autenticar: RequestHandler;
  sesiones: Sesiones;
  listaRevocados: ListaRevocados;
}

export function crearModuloUsuarios({
  autenticar,
  sesiones,
  listaRevocados,
}: DependenciasUsuarios): Router {
  const servicio = crearUsuariosService({
    repositorio: usuariosRepository,
    sesiones,
    listaRevocados,
  });
  return crearUsuariosRouter(crearUsuariosController(servicio), autenticar);
}
