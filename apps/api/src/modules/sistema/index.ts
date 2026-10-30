import type { Router } from 'express';
import type { Logger } from 'pino';
import { crearSistemaController } from './sistema.controller.js';
import { sistemaRepository } from './sistema.repository.js';
import { crearSistemaRouter } from './sistema.routes.js';
import { crearSistemaService } from './sistema.service.js';
import type { VerificadorRedis } from './sistema.types.js';

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
