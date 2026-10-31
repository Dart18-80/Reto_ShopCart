import type { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import type { Logger } from 'pino';

const SALIDA_NORMAL = 0;
const SALIDA_CON_ERROR = 1;

export interface DependenciasApagado {
  /** process en producción; un EventEmitter en las pruebas. */
  proceso: Pick<EventEmitter, 'on' | 'once'>;
  servidor: Pick<Server, 'close'>;
  /** Cierres de los recursos abiertos (pool de SQL Server, Redis). */
  recursos: readonly (() => Promise<unknown>)[];
  logger: Logger;
  salir: (codigo: number) => void;
  esperaMaximaMs: number;
}

/**
 * SIGTERM/SIGINT apagan ordenadamente: el servidor deja de aceptar conexiones, espera las peticiones
 * en curso y cierra los recursos. Un error no capturado o una promesa rechazada sin manejar dejan el
 * proceso en un estado desconocido: se registran como fatales y se apaga igual, pero con código 1.
 */
export function registrarApagadoOrdenado({
  proceso,
  servidor,
  recursos,
  logger,
  salir,
  esperaMaximaMs,
}: DependenciasApagado): void {
  let apagando = false;
  let terminado = false;
  let forzarSalida: NodeJS.Timeout | undefined;
  // El código más grave gana: un error fatal durante un apagado normal termina con 1.
  let codigoSalida = SALIDA_NORMAL;

  const terminar = (codigo: number): void => {
    if (terminado) return;
    terminado = true;
    clearTimeout(forzarSalida);
    salir(codigo);
  };

  const apagar = (codigo: number): void => {
    codigoSalida = Math.max(codigoSalida, codigo);
    if (apagando) return;
    apagando = true;

    forzarSalida = setTimeout(() => {
      logger.error('El apagado tardó demasiado; se fuerza la salida');
      terminar(SALIDA_CON_ERROR);
    }, esperaMaximaMs);
    forzarSalida.unref();

    servidor.close(() => {
      // Dentro de then: un cierre que lanza de forma síncrona también queda como rechazo y no deja a
      // los demás sin cerrar.
      void Promise.allSettled(recursos.map((cerrar) => Promise.resolve().then(cerrar))).then(
        (cierres) => {
          for (const cierre of cierres) {
            if (cierre.status === 'rejected') {
              logger.warn({ err: cierre.reason }, 'Un recurso no se cerró limpiamente');
            }
          }
          logger.info('API detenida');
          terminar(codigoSalida);
        },
      );
    });
  };

  const alRecibirSenal = (senal: string): void => {
    logger.info({ senal }, 'Apagando la API');
    apagar(SALIDA_NORMAL);
  };
  proceso.once('SIGTERM', alRecibirSenal);
  proceso.once('SIGINT', alRecibirSenal);

  proceso.on('uncaughtException', (error: unknown) => {
    logger.fatal({ err: error }, 'Error no capturado');
    apagar(SALIDA_CON_ERROR);
  });
  proceso.on('unhandledRejection', (motivo: unknown) => {
    logger.fatal({ err: motivo }, 'Promesa rechazada sin manejar');
    apagar(SALIDA_CON_ERROR);
  });
}
