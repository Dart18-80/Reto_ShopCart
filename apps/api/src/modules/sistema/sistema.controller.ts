import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import type { SistemaService } from './sistema.service.js';

const HTTP_OK = 200;
const HTTP_SERVICIO_NO_DISPONIBLE = 503;

export interface SistemaController {
  health: RequestHandler;
}

export function crearSistemaController(servicio: SistemaService): SistemaController {
  return {
    health: manejar({}, async (_entrada, res) => {
      const salud = await servicio.salud();
      // Sin base la réplica no puede atender: con 503 el healthcheck de Docker la marca unhealthy.
      res
        .status(salud.estado === 'caido' ? HTTP_SERVICIO_NO_DISPONIBLE : HTTP_OK)
        .json({ datos: salud });
    }),
  };
}
