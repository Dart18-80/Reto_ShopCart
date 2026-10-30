import type { Request, Response } from 'express';
import type { SistemaService } from './sistema.service.js';

const HTTP_OK = 200;
const HTTP_SERVICIO_NO_DISPONIBLE = 503;

export function crearSistemaController(servicio: SistemaService) {
  // Funciones flecha: el router las recibe sueltas, sin su objeto.
  return {
    health: async (_req: Request, res: Response): Promise<void> => {
      const salud = await servicio.salud();
      // Sin base la réplica no puede atender: 503 hace que nginx y el healthcheck la saquen.
      res
        .status(salud.estado === 'caido' ? HTTP_SERVICIO_NO_DISPONIBLE : HTTP_OK)
        .json({ datos: salud });
    },
  };
}

export type SistemaController = ReturnType<typeof crearSistemaController>;
