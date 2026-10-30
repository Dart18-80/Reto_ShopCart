import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { obtenerContexto } from '../http/contexto.js';
import { AppError } from './app-error.js';

export interface RespuestaError {
  error: {
    codigo: string;
    mensaje: string;
    detalles?: unknown;
    requestId: string;
  };
}

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new AppError('NO_ENCONTRADO', 'La ruta solicitada no existe.'));
};

/** Middleware central (A-06): un solo formato de error para toda la API. */
export function manejadorErrores(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = aAppError(error);
    if (appError.status >= 500) {
      // El detalle completo solo va al log; el cliente recibe un mensaje genérico.
      logger.error({ err: error }, 'Error inesperado');
    } else {
      logger.warn({ codigo: appError.codigo, estado: appError.status }, appError.message);
    }

    const cuerpo: RespuestaError = {
      error: {
        codigo: appError.codigo,
        mensaje: appError.message,
        ...(appError.detalles === undefined ? {} : { detalles: appError.detalles }),
        requestId: obtenerContexto()?.requestId ?? res.getHeader('X-Request-Id')?.toString() ?? '',
      },
    };
    res.status(appError.status).json(cuerpo);
  };
}

function aAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const tipo = errorDelParserJson(error);
  if (tipo === 'entity.parse.failed') return new AppError('JSON_INVALIDO');
  if (tipo === 'entity.too.large') return new AppError('CUERPO_DEMASIADO_GRANDE');
  return new AppError('ERROR_INTERNO', undefined, undefined, { cause: error });
}

// express.json() marca sus errores con la propiedad `type`.
function errorDelParserJson(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  return typeof error.type === 'string' ? error.type : undefined;
}
