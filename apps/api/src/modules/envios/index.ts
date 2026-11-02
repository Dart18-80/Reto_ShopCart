import type { RequestHandler, Router } from 'express';
import { crearEnviosController } from './envios.controller.js';
import { enviosRepository } from './envios.repository.js';
import { crearEnviosRouter } from './envios.routes.js';
import { crearEnviosService } from './envios.service.js';

interface DependenciasEnvios {
  autenticar: RequestHandler;
}

/** Monta /envios/metodos (público) y /admin/envios/metodos (Admin). */
export function crearModuloEnvios({ autenticar }: DependenciasEnvios): Router {
  const servicio = crearEnviosService({ repositorio: enviosRepository });
  return crearEnviosRouter(crearEnviosController(servicio), autenticar);
}
