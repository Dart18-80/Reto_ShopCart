import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import { obtenerContexto } from '../http/contexto.js';
import { ENCABEZADO_REQUEST_ID } from '../http/request-id.js';
import { AppError } from './app-error.js';
import type { CodigoError } from './catalogo.js';

const ESTADO_PRIMER_ERROR_INTERNO = 500;

// express.json() marca sus errores con la propiedad `type`; un caso nuevo se agrega aquí.
const ERRORES_DEL_PARSER_JSON: Readonly<Record<string, CodigoError>> = {
  'entity.parse.failed': 'JSON_INVALIDO',
  'entity.too.large': 'CUERPO_DEMASIADO_GRANDE',
  'charset.unsupported': 'CONTENIDO_NO_SOPORTADO',
  'encoding.unsupported': 'CONTENIDO_NO_SOPORTADO',
};

interface RespuestaError {
  error: {
    codigo: string;
    mensaje: string;
    detalles?: unknown;
    requestId: string;
  };
}

export const rutaNoEncontrada: RequestHandler = (_req, _res, next) => {
  next(new AppError('NO_ENCONTRADO', { mensaje: 'La ruta solicitada no existe.' }));
};

/** Middleware central (A-06): un solo formato de error para toda la API. */
export function manejadorErrores(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      // El manejador final de Express solo usa console.error: se registra aquí, con el requestId.
      logger.error({ err: error }, 'Error después de enviar la respuesta');
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
    // El detalle completo solo va al log; el cliente recibe un mensaje genérico. Si hay causa (el error
    // de SQL detrás de un ERROR_INTERNO), se registra esa: trae el número y el SP.
    logger.error({ err: appError.cause ?? original }, 'Error inesperado');
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
  return obtenerContexto()?.requestId ?? res.getHeader(ENCABEZADO_REQUEST_ID)?.toString() ?? '';
}

function aAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const tipo = errorDelParserJson(error);
  const codigoDelParser = tipo === undefined ? undefined : ERRORES_DEL_PARSER_JSON[tipo];
  if (codigoDelParser !== undefined) return new AppError(codigoDelParser);
  return new AppError('ERROR_INTERNO', { cause: error });
}

function errorDelParserJson(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  return typeof error.type === 'string' ? error.type : undefined;
}
