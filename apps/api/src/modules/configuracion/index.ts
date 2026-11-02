import type { RequestHandler, Router } from 'express';
import type { InvalidadorReportes } from '../reportes/index.js';
import { crearConfiguracionController } from './configuracion.controller.js';
import { configuracionRepository } from './configuracion.repository.js';
import { crearConfiguracionRouter } from './configuracion.routes.js';
import { crearConfiguracionService } from './configuracion.service.js';

interface DependenciasConfiguracion {
  autenticar: RequestHandler;
  reportes: InvalidadorReportes;
}

/** Monta /admin/configuracion (Admin). */
export function crearModuloConfiguracion({
  autenticar,
  reportes,
}: DependenciasConfiguracion): Router {
  const servicio = crearConfiguracionService({ repositorio: configuracionRepository, reportes });
  return crearConfiguracionRouter(crearConfiguracionController(servicio), autenticar);
}
