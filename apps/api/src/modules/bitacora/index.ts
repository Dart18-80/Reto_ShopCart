import type { RequestHandler, Router } from 'express';
import { crearBitacoraController } from './bitacora.controller.js';
import { bitacoraRepository } from './bitacora.repository.js';
import { crearBitacoraRouter } from './bitacora.routes.js';

interface DependenciasBitacora {
  autenticar: RequestHandler;
}

/** Monta /bitacora (Admin). */
export function crearModuloBitacora({ autenticar }: DependenciasBitacora): Router {
  return crearBitacoraRouter(crearBitacoraController(bitacoraRepository), autenticar);
}
