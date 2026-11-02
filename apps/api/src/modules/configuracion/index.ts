import type { RequestHandler, Router } from 'express';
import { crearConfiguracionController } from './configuracion.controller.js';
import { configuracionRepository } from './configuracion.repository.js';
import { crearConfiguracionRouter } from './configuracion.routes.js';
import { crearConfiguracionService } from './configuracion.service.js';

interface DependenciasConfiguracion {
  autenticar: RequestHandler;
}

/** Monta /admin/configuracion (Admin). */
export function crearModuloConfiguracion({ autenticar }: DependenciasConfiguracion): Router {
  const servicio = crearConfiguracionService({ repositorio: configuracionRepository });
  return crearConfiguracionRouter(crearConfiguracionController(servicio), autenticar);
}
