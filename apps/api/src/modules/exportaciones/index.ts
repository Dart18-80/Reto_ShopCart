import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { AlmacenArchivos } from '../../shared/almacen/index.js';
import type { Cache } from '../../shared/cache/index.js';
import type { LimitadorIntentos } from '../../shared/http/index.js';
import type { Tarea } from '../../shared/jobs/index.js';
import { relojDelSistema, type Reloj } from '../../shared/reloj/index.js';
import { crearServicioReportes } from '../reportes/index.js';
import { crearExportacionesController } from './exportaciones.controller.js';
import {
  crearProcesadorExportaciones as crearProcesador,
  type ProcesadorExportaciones,
} from './exportaciones.procesador.js';
import { exportacionesRepository } from './exportaciones.repository.js';
import { crearExportacionesRouter } from './exportaciones.routes.js';
import { crearExportacionesService } from './exportaciones.service.js';
import { tareasExportaciones } from './exportaciones.tareas.js';

export type { ProcesadorExportaciones } from './exportaciones.procesador.js';

interface DependenciasProcesador {
  almacen: AlmacenArchivos;
  cache: Cache;
  logger: Logger;
  reloj?: Reloj;
}

/**
 * A-24: el consumidor de la cola de esta réplica. Uno solo por proceso: lo comparten el POST (que procesa de
 * inmediato) y la tarea periódica, así la concurrencia máxima por réplica es real.
 */
export const crearProcesadorExportaciones = ({
  almacen,
  cache,
  logger,
  reloj = relojDelSistema,
}: DependenciasProcesador): ProcesadorExportaciones =>
  crearProcesador({
    repositorio: exportacionesRepository,
    reportes: crearServicioReportes(cache, logger),
    almacen,
    logger: logger.child({ modulo: 'exportaciones' }),
    reloj,
  });

interface DependenciasExportaciones {
  autenticar: RequestHandler;
  almacen: AlmacenArchivos;
  procesador: ProcesadorExportaciones;
  limitador: LimitadorIntentos;
  logger: Logger;
  reloj: Reloj;
}

/** Monta /admin/reportes/:reporte/exportaciones y /admin/exportaciones (Admin). */
export function crearModuloExportaciones({
  autenticar,
  almacen,
  procesador,
  limitador,
  logger,
  reloj,
}: DependenciasExportaciones): Router {
  const servicio = crearExportacionesService({
    repositorio: exportacionesRepository,
    almacen,
    procesador,
    logger: logger.child({ modulo: 'exportaciones' }),
    reloj,
  });
  return crearExportacionesRouter(crearExportacionesController(servicio), autenticar, limitador);
}

/** A-04, A-24: consumo de la cola (las dos réplicas, en competencia) y purga horaria de los archivos vencidos. */
export const crearTareasDeExportaciones = ({
  procesador,
  almacen,
  logger,
}: Pick<DependenciasExportaciones, 'procesador' | 'almacen' | 'logger'>): Tarea[] =>
  tareasExportaciones({
    procesador,
    repositorio: exportacionesRepository,
    almacen,
    logger: logger.child({ modulo: 'exportaciones', tarea: 'purga' }),
  });
