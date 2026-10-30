import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

const NANOSEGUNDOS_POR_MS = 1_000_000;

/** Una línea por petición con método, ruta, estado y duración. Nunca registra cuerpos ni headers. */
export function registrarPeticiones(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const duracionMs = Number(process.hrtime.bigint() - inicio) / NANOSEGUNDOS_POR_MS;
      logger.info(
        {
          metodo: req.method,
          ruta: req.originalUrl.split('?')[0],
          estado: res.statusCode,
          duracionMs: Math.round(duracionMs),
        },
        'Petición atendida',
      );
    });
    next();
  };
}
