import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { ListaRevocados } from '../http/autenticar.js';
import { VIGENCIA_ACCESO_SEG } from '../http/token-acceso.js';

const PREFIJO = 'revocado:';

/**
 * N-15: un usuario desactivado queda en Redis lo que dura un access token (15 min). Redis solo guarda
 * lo que se puede perder (RNF-2): los refresh tokens ya quedaron revocados en SQL Server.
 */
export function crearListaRevocadosRedis(
  cliente: Pick<Redis, 'del' | 'exists' | 'set'>,
  logger: Logger,
): ListaRevocados {
  return {
    async estaRevocado(idUsuario) {
      try {
        return (await cliente.exists(`${PREFIJO}${String(idUsuario)}`)) === 1;
      } catch {
        // N-15: con Redis caído el riesgo queda acotado a la ventana del access token; la caída ya
        // la registra registrarCambiosDeEstado, así que aquí no se repite en cada petición.
        return false;
      }
    },

    async revocar(idUsuario) {
      try {
        await cliente.set(`${PREFIJO}${String(idUsuario)}`, '1', 'EX', VIGENCIA_ACCESO_SEG);
      } catch (error) {
        logger.warn(
          { err: error, idUsuario },
          'No se pudo agregar el usuario a la lista de revocados: su access token vence en 15 min',
        );
      }
    },

    async restaurar(idUsuario) {
      try {
        await cliente.del(`${PREFIJO}${String(idUsuario)}`);
      } catch (error) {
        logger.warn(
          { err: error, idUsuario },
          'No se pudo sacar al usuario de la lista de revocados: recupera el acceso en 15 min',
        );
      }
    },
  };
}
