import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import { obtenerContexto } from '../http/contexto.js';
import { AppError } from './app-error.js';

const ESTADO_PRIMER_ERROR_INTERNO = 500;

interface RespuestaError {
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
    registrarError(logger, appError, error);
    res.status(appError.status).json(cuerpoDeError(appError, requestIdDe(res)));
  };
}

function registrarError(logger: Logger, appError: AppError, original: unknown): void {
  if (appError.status >= ESTADO_PRIMER_ERROR_INTERNO) {
    // El detalle completo solo va al log; el cliente recibe un mensaje genérico.
    logger.error({ err: original }, 'Error inesperado');
    return;
  }
  logger.warn({ codigo: appError.codigo, estado: appError.status }, appError.message);
}

function cuerpoDeError(appError: AppError, requestId: string): RespuestaError {
  return {
    error: {
      codigo: appError.codigo,
      mensaje: appError.message,
      ...(appError.detalles === undefined ? {} : { detalles: appError.detalles }),
      requestId,
    },
  };
}

function requestIdDe(res: Response): string {
  return obtenerContexto()?.requestId ?? res.getHeader('X-Request-Id')?.toString() ?? '';
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
