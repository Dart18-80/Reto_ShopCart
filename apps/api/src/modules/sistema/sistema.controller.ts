import type { Request, Response } from 'express';
import type { SistemaService } from './sistema.service.js';

export function crearSistemaController(servicio: SistemaService) {
  // Funciones flecha: el router las recibe sueltas, sin su objeto.
  return {
    health: async (_req: Request, res: Response): Promise<void> => {
      const salud = await servicio.salud();
      // Sin base la réplica no puede atender: 503 hace que nginx y el healthcheck la saquen.
      res.status(salud.estado === 'caido' ? 503 : 200).json({ datos: salud });
    },
  };
}

export type SistemaController = ReturnType<typeof crearSistemaController>;
