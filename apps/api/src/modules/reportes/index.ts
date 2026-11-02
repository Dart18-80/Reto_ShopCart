import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { Cache } from '../../shared/cache/index.js';
import type { TokensAcceso, VersionesSesion } from '../../shared/http/index.js';
import { crearReportesController } from './reportes.controller.js';
import type { DifusorDeVersiones } from './reportes.eventos.js';
import { reportesRepository } from './reportes.repository.js';
import { crearReportesRouter } from './reportes.routes.js';
import { crearReportesService, type ReportesService } from './reportes.service.js';
import { crearTiempoRealService } from './reportes.tiempo-real.js';

interface DependenciasReportes {
  autenticar: RequestHandler;
  cache: Cache;
  logger: Logger;
  difusor: DifusorDeVersiones;
  tokens: Pick<TokensAcceso, 'verificar'>;
  versiones: Pick<VersionesSesion, 'vigente'>;
}

/** Monta /dashboard y el stream /admin/reportes/eventos (Admin). */
export function crearModuloReportes({
  autenticar,
  cache,
  logger,
  difusor,
  tokens,
  versiones,
}: DependenciasReportes): Router {
  return crearReportesRouter(
    crearReportesController(
      crearServicioReportes(cache, logger),
      crearTiempoRealService({ difusor, tokens, versiones }),
    ),
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
export {
  crearDifusorDeVersiones,
  INTERVALO_LATIDO_MS,
  MAX_CONEXIONES_POR_USUARIO,
  VENTANA_AGRUPACION_MS,
  type DifusorDeVersiones,
} from './reportes.eventos.js';
export { consultaRangoSchema, consultaVentasSchema } from './reportes.schemas.js';
export type { ReportesService } from './reportes.service.js';
