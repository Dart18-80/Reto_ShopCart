import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  type RateLimiterAbstract,
} from 'rate-limiter-flexible';
import type { LimitadorIntentos } from '../http/limitar-intentos.js';
import { crearRegistroPorCambioDeEstado } from './redis.js';

export interface OpcionesLimitador {
  prefijo: string;
  intentos: number;
  ventanaSeg: number;
}

type Resultado = Awaited<ReturnType<LimitadorIntentos['consumir']>>;

const PERMITIDO: Resultado = { permitido: true, segundosParaReintentar: 0 };

// rate-limiter-flexible rechaza con RateLimiterRes cuando se agotaron los intentos.
async function consumirEn(limitador: RateLimiterAbstract, clave: string): Promise<Resultado> {
  try {
    await limitador.consume(clave);
    return PERMITIDO;
  } catch (rechazo) {
    if (!(rechazo instanceof RateLimiterRes)) throw rechazo;
    return { permitido: false, segundosParaReintentar: Math.ceil(rechazo.msBeforeNext / 1000) };
  }
}

/**
 * A-07: contador compartido entre réplicas en Redis. Si Redis falla (caído, con error de respuesta o
 * sin contestar a tiempo), cae a un contador en memoria por réplica y la API no se bloquea; la falla se
 * registra una vez por cambio de estado.
 */
export function crearLimitadorRedis(
  cliente: Redis,
  logger: Logger,
  { prefijo, intentos, ventanaSeg }: OpcionesLimitador,
): LimitadorIntentos {
  const opciones = { keyPrefix: prefijo, points: intentos, duration: ventanaSeg };
  const enMemoria = new RateLimiterMemory(opciones);
  const enRedis = new RateLimiterRedis({
    ...opciones,
    storeClient: cliente,
    rejectIfRedisNotReady: true,
  });
  const registro = crearRegistroPorCambioDeEstado(logger, `limitador ${prefijo}`);

  return {
    async consumir(clave) {
      try {
        const resultado = await consumirEn(enRedis, clave);
        registro.exito();
        return resultado;
      } catch (error) {
        registro.fallo(error);
        return consumirEn(enMemoria, clave);
      }
    },
  };
}
