import type { Redis } from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import type { LimitadorIntentos } from '../http/limitar-intentos.js';

export interface OpcionesLimitador {
  prefijo: string;
  intentos: number;
  ventanaSeg: number;
}

/**
 * A-07: contador compartido entre réplicas en Redis. Si Redis no responde, cae a un contador en
 * memoria por réplica (insuranceLimiter) y la API no se bloquea.
 */
export function crearLimitadorRedis(
  cliente: Redis,
  { prefijo, intentos, ventanaSeg }: OpcionesLimitador,
): LimitadorIntentos {
  const enMemoria = new RateLimiterMemory({
    keyPrefix: prefijo,
    points: intentos,
    duration: ventanaSeg,
  });
  const limitador = new RateLimiterRedis({
    storeClient: cliente,
    keyPrefix: prefijo,
    points: intentos,
    duration: ventanaSeg,
    insuranceLimiter: enMemoria,
    rejectIfRedisNotReady: true,
  });
  return {
    async consumir(clave) {
      try {
        await limitador.consume(clave);
        return { permitido: true, segundosParaReintentar: 0 };
      } catch (rechazo) {
        // rate-limiter-flexible rechaza con RateLimiterRes cuando se agotaron los intentos.
        if (rechazo instanceof RateLimiterRes) {
          return {
            permitido: false,
            segundosParaReintentar: Math.ceil(rechazo.msBeforeNext / 1000),
          };
        }
        throw rechazo;
      }
    },
  };
}
