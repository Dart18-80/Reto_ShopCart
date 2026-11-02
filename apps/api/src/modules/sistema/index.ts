import type { Router } from 'express';
import type { Logger } from 'pino';
import type { Tarea } from '../../shared/jobs/index.js';
import { crearSistemaController } from './sistema.controller.js';
import { sistemaRepository } from './sistema.repository.js';
import { crearSistemaRouter } from './sistema.routes.js';
import { crearSistemaService } from './sistema.service.js';
import { tareasSistema } from './sistema.tareas.js';
import type { VerificadorRedis } from './sistema.types.js';

/** A-04: purga de las llaves de idempotencia (E5-H04). */
export const crearTareasDeSistema = (): Tarea[] => tareasSistema(sistemaRepository);

export type { EstadoSalud, VerificadorRedis } from './sistema.types.js';

interface DependenciasSistema {
  redis: VerificadorRedis;
  instancia: string;
  logger: Logger;
}

export function crearModuloSistema({ redis, instancia, logger }: DependenciasSistema): Router {
  const servicio = crearSistemaService({
    repositorio: sistemaRepository,
    redis,
    instancia,
    logger: logger.child({ modulo: 'sistema' }),
  });
  return crearSistemaRouter(crearSistemaController(servicio));
}
