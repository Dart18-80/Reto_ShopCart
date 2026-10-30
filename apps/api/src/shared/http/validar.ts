import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface Esquemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

type Parte = keyof Esquemas;

const PARTES: readonly Parte[] = ['params', 'query', 'body'];

interface ErrorDeCampo {
  campo: string;
  mensaje: string;
}

interface ResultadoValidacion {
  errores: ErrorDeCampo[];
  validos: Partial<Record<Parte, unknown>>;
}

/** Valida y reemplaza body, params y query por sus valores ya transformados por Zod. */
export function validar(esquemas: Esquemas): RequestHandler {
  return (req, _res, next) => {
    const { errores, validos } = validarPartes(req, esquemas);
    if (errores.length > 0) {
      next(new AppError('VALIDACION_FALLIDA', undefined, { errores }));
      return;
    }
    reemplazarPartes(req, validos);
    next();
  };
}

function validarPartes(req: Request, esquemas: Esquemas): ResultadoValidacion {
  const resultado: ResultadoValidacion = { errores: [], validos: {} };
  for (const parte of PARTES) {
    const esquema = esquemas[parte];
    if (esquema === undefined) continue;

    const validacion = esquema.safeParse(req[parte]);
    if (validacion.success) {
      resultado.validos[parte] = validacion.data;
      continue;
    }
    for (const problema of validacion.error.issues) {
      resultado.errores.push({
        campo: [parte, ...problema.path].join('.'),
        mensaje: problema.message,
      });
    }
  }
  return resultado;
}

function reemplazarPartes(req: Request, validos: Partial<Record<Parte, unknown>>): void {
  for (const [parte, valor] of Object.entries(validos)) {
    // Express 5 expone req.query como getter: se redefine la propiedad en lugar de asignarla.
    Object.defineProperty(req, parte, { value: valor, writable: true, configurable: true });
  }
}
