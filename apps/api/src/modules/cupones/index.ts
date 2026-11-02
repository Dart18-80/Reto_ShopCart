import type { RequestHandler, Router } from 'express';
import { crearCuponesController } from './cupones.controller.js';
import { cuponesRepository } from './cupones.repository.js';
import { crearCuponesRouter } from './cupones.routes.js';
import { crearCuponesService } from './cupones.service.js';

interface DependenciasCupones {
  autenticar: RequestHandler;
}

/** Monta /admin/cupones (Admin). */
export function crearModuloCupones({ autenticar }: DependenciasCupones): Router {
  const servicio = crearCuponesService({ repositorio: cuponesRepository });
  return crearCuponesRouter(crearCuponesController(servicio), autenticar);
}
