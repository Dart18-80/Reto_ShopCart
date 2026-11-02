import type { RequestHandler } from 'express';
import { manejar, paginar } from '../../shared/http/index.js';
import { consultaBitacoraSchema } from './bitacora.schemas.js';
import type { BitacoraService } from './bitacora.service.js';

export interface BitacoraController {
  listar: RequestHandler;
}

export function crearBitacoraController(servicio: BitacoraService): BitacoraController {
  return {
    listar: manejar({ query: consultaBitacoraSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.listar(query);
      const datos = filas.map((registro) => ({ ...registro, fecha: registro.fecha.toISOString() }));
      res.json(paginar(datos, total, query));
    }),
  };
}
