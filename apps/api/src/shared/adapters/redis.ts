import { Redis } from 'ioredis';

const ESPERA_PING_MS = 500;

/**
 * RNF-2: Redis solo guarda lo que se puede perder. Sin cola fuera de línea y con un solo intento por
 * comando, una caída de Redis falla rápido en lugar de dejar peticiones esperando.
 */
export function crearClienteRedis(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (intentos) => Math.min(intentos * 200, 2000),
  });
}

/** Adaptador del puerto VerificadorRedis (módulo sistema). */
export function crearVerificadorRedis(cliente: Redis) {
  return {
    async ping(): Promise<boolean> {
      try {
        await Promise.race([
          cliente.ping(),
          new Promise<never>((_resolve, rechazar) =>
            setTimeout(() => {
              rechazar(new Error('Tiempo de espera de Redis agotado'));
            }, ESPERA_PING_MS),
          ),
        ]);
        return true;
      } catch {
        return false;
      }
    },
  };
}
