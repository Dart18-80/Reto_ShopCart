import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { Cache } from '../../shared/cache/index.js';
import { crearReportesController } from './reportes.controller.js';
import { reportesRepository } from './reportes.repository.js';
import { crearReportesRouter } from './reportes.routes.js';
import { crearReportesService, type ReportesService } from './reportes.service.js';

interface DependenciasReportes {
  autenticar: RequestHandler;
  cache: Cache;
  logger: Logger;
}

/** Monta /dashboard (Admin). */
export function crearModuloReportes({ autenticar, cache, logger }: DependenciasReportes): Router {
  return crearReportesRouter(
    crearReportesController(crearServicioReportes(cache, logger)),
    autenticar,
  );
}

/** E7-H05: el servicio de reportes, con su caché, para generar los archivos de las exportaciones. */
export const crearServicioReportes = (cache: Cache, logger: Logger): ReportesService =>
  crearReportesService({
    repositorio: reportesRepository,
    cache,
    logger: logger.child({ modulo: 'reportes' }),
  });

export {
  crearInvalidadorReportes,
  hashDeFiltros,
  normalizarFiltros,
  type DominioReportes,
  type InvalidadorReportes,
} from './reportes.cache.js';
export { consultaRangoSchema, consultaVentasSchema } from './reportes.schemas.js';
export type { ReportesService } from './reportes.service.js';
