import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

/** Puerto del rate limiting (A-07): el adaptador vive en shared/adapters/limitador-redis.ts. */
export interface LimitadorIntentos {
  consumir(clave: string): Promise<{ permitido: boolean; segundosParaReintentar: number }>;
}

/** Rechaza con 429 y Retry-After cuando la clave agotó sus intentos en la ventana. */
export function limitarIntentos(
  limitador: LimitadorIntentos,
  claveDe: (req: Request) => string,
): RequestHandler {
  return async (req, res, next) => {
    const { permitido, segundosParaReintentar } = await limitador.consumir(claveDe(req));
    if (!permitido) {
      res.setHeader('Retry-After', String(segundosParaReintentar));
      next(new AppError('DEMASIADAS_PETICIONES'));
      return;
    }
    next();
  };
}
