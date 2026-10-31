import type { RequestHandler, Router } from 'express';
import { crearDireccionesController } from './direcciones.controller.js';
import { direccionesRepository } from './direcciones.repository.js';
import { crearDireccionesRouter } from './direcciones.routes.js';
import { crearDireccionesService } from './direcciones.service.js';

interface DependenciasDirecciones {
  autenticar: RequestHandler;
}

/** Monta /direcciones (Cliente) y /departamentos (público). */
export function crearModuloDirecciones({ autenticar }: DependenciasDirecciones): Router {
  const servicio = crearDireccionesService({ repositorio: direccionesRepository });
  return crearDireccionesRouter(crearDireccionesController(servicio), autenticar);
}
