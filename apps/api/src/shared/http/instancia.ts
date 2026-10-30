import type { RequestHandler } from 'express';

// RNF-2: permite ver en la demo qué réplica atendió cada petición detrás de nginx.
export function encabezadoInstancia(instancia: string): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Instancia', instancia);
    next();
  };
}
