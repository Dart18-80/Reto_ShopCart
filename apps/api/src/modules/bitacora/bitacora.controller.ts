import type { RequestHandler } from 'express';
import { manejar, paginar } from '../../shared/http/index.js';
import type { BitacoraRepository } from './bitacora.repository.js';
import { consultaBitacoraSchema } from './bitacora.schemas.js';

export interface BitacoraController {
  listar: RequestHandler;
}

// Solo lectura y sin reglas propias: sin servicio intermedio que solo reenvíe (KISS).
export function crearBitacoraController(repositorio: BitacoraRepository): BitacoraController {
  return {
    listar: manejar({ query: consultaBitacoraSchema }, async ({ query }, res) => {
      const { filas, total } = await repositorio.listar(query);
      const datos = filas.map((registro) => ({ ...registro, fecha: registro.fecha.toISOString() }));
      res.json(paginar(datos, total, query));
    }),
  };
}
