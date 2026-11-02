import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Cache } from '../cache/index.js';
import { crearRegistroPorCambioDeEstado } from './redis.js';

/** A-11: adaptador del puerto Cache sobre Redis. Con Redis caído degrada a "no está" y lo registra una vez. */
export function crearCacheRedis(
  cliente: Pick<Redis, 'get' | 'set' | 'incr'>,
  logger: Logger,
): Cache {
  const registro = crearRegistroPorCambioDeEstado(logger, 'caché de reportes');

  async function tolerante<T>(accion: () => Promise<T>, siFalla: T): Promise<T> {
    try {
      const resultado = await accion();
      registro.exito();
      return resultado;
    } catch (error) {
      registro.fallo(error);
      return siFalla;
    }
  }

  return {
    obtener: (clave) => tolerante(() => cliente.get(clave), null),

    guardar: (clave, valor, segundos) =>
      tolerante(async () => {
        await cliente.set(clave, valor, 'EX', segundos);
      }, undefined),

    contador: (clave) => tolerante(async () => Number((await cliente.get(clave)) ?? 0), null),

    incrementar: (clave) =>
      tolerante(async () => {
        await cliente.incr(clave);
      }, undefined),
  };
}
