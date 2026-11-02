import type { RequestHandler, Router } from 'express';
import type { Cache } from '../../shared/cache/index.js';
import { crearReportesController } from './reportes.controller.js';
import { reportesRepository } from './reportes.repository.js';
import { crearReportesRouter } from './reportes.routes.js';
import { crearReportesService } from './reportes.service.js';

interface DependenciasReportes {
  autenticar: RequestHandler;
  cache: Cache;
}

/** Monta /dashboard (Admin). */
export function crearModuloReportes({ autenticar, cache }: DependenciasReportes): Router {
  return crearReportesRouter(
    crearReportesController(crearReportesService({ repositorio: reportesRepository, cache })),
    autenticar,
  );
}

export { crearInvalidadorReportes, type InvalidadorReportes } from './reportes.cache.js';
