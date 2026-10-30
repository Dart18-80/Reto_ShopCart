import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface Esquemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

type Parte = keyof Esquemas;

/** Valida y reemplaza body, params y query por sus valores ya transformados por Zod. */
export function validar(esquemas: Esquemas): RequestHandler {
  return (req, _res, next) => {
    const errores: { campo: string; mensaje: string }[] = [];
    const validos: Partial<Record<Parte, unknown>> = {};

    for (const parte of ['params', 'query', 'body'] as const) {
      const esquema = esquemas[parte];
      if (esquema === undefined) continue;
      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        validos[parte] = resultado.data;
      } else {
        for (const problema of resultado.error.issues) {
          errores.push({ campo: [parte, ...problema.path].join('.'), mensaje: problema.message });
        }
      }
    }

    if (errores.length > 0) {
      next(new AppError('VALIDACION_FALLIDA', undefined, { errores }));
      return;
    }

    for (const [parte, valor] of Object.entries(validos)) {
      // Express 5 expone req.query como getter: se redefine la propiedad en lugar de asignarla.
      Object.defineProperty(req, parte, { value: valor, writable: true, configurable: true });
    }
    next();
  };
}
