import type { RequestHandler, Router } from 'express';
import type { Cache } from '../../shared/cache/index.js';
import { crearReportesController } from './reportes.controller.js';
import { reportesRepository } from './reportes.repository.js';
import { crearReportesRouter } from './reportes.routes.js';
import { crearReportesService, type ReportesService } from './reportes.service.js';

interface DependenciasReportes {
  autenticar: RequestHandler;
  cache: Cache;
}

/** Monta /dashboard (Admin). */
export function crearModuloReportes({ autenticar, cache }: DependenciasReportes): Router {
  return crearReportesRouter(crearReportesController(crearServicioReportes(cache)), autenticar);
}

/** E7-H05: el servicio de reportes, con su caché, para generar los archivos de las exportaciones. */
export const crearServicioReportes = (cache: Cache): ReportesService =>
  crearReportesService({ repositorio: reportesRepository, cache });

export {
  crearInvalidadorReportes,
  hashDeFiltros,
  normalizarFiltros,
  type InvalidadorReportes,
} from './reportes.cache.js';
export { consultaRangoSchema, consultaVentasSchema } from './reportes.schemas.js';
export type { ReportesService } from './reportes.service.js';
