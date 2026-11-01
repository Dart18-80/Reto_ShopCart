import type { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { ConfiguracionRedis } from '../config/index.js';

const ESPERA_PING_MS = 500;
const ESPERA_COMANDO_MS = 500;
const ESPERA_REINTENTO_MS = 200;
const ESPERA_MAXIMA_REINTENTO_MS = 2000;

/**
 * RNF-2: Redis solo guarda lo que se puede perder. Sin cola fuera de línea y con un solo intento por
 * comando, una caída de Redis falla rápido en lugar de dejar peticiones esperando. El tiempo límite por
 * comando cubre el caso que la cola no ve: un Redis bloqueado con la conexión todavía abierta.
 */
export function crearClienteRedis(config: ConfiguracionRedis): Redis {
  return new Redis({
    host: config.servidor,
    port: config.puerto,
    password: config.contrasena,
    db: config.baseDatos,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: ESPERA_COMANDO_MS,
    retryStrategy: (intentos) =>
      Math.min(intentos * ESPERA_REINTENTO_MS, ESPERA_MAXIMA_REINTENTO_MS),
  });
}

/** Adaptador del puerto VerificadorRedis (módulo sistema). */
export function crearVerificadorRedis(cliente: Pick<Redis, 'ping'>): { ping(): Promise<boolean> } {
  return {
    async ping(): Promise<boolean> {
      let temporizador: NodeJS.Timeout | undefined;
      const tiempoAgotado = new Promise<never>((_resolve, rechazar) => {
        temporizador = setTimeout(() => {
          rechazar(new Error('Tiempo de espera de Redis agotado'));
        }, ESPERA_PING_MS);
      });
      try {
        await Promise.race([cliente.ping(), tiempoAgotado]);
        return true;
      } catch {
        // RNF-2: Redis caído es "degradado", no un error; el fallo ya lo registra el evento 'error'.
        return false;
      } finally {
        clearTimeout(temporizador);
      }
    },
  };
}

/**
 * RNF-2: con Redis caído, ioredis reintenta y emite 'error' en cada intento. Solo se registran los
 * cambios de estado (una vez cuando cae, una vez cuando vuelve) para no llenar el log.
 */
export function registrarCambiosDeEstado(cliente: Pick<EventEmitter, 'on'>, logger: Logger): void {
  let disponible: boolean | undefined;
  cliente.on('error', (error: Error) => {
    if (disponible === false) return;
    disponible = false;
    logger.warn({ err: error }, 'Redis no responde: la API sigue en modo degradado');
  });
  cliente.on('ready', () => {
    if (disponible === true) return;
    disponible = true;
    logger.info('Redis disponible');
  });
}
