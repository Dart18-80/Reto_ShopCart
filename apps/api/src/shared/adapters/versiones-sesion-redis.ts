import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { VersionesSesion } from '../http/autenticar.js';
import { VIGENCIA_ACCESO_SEG } from '../http/token-acceso.js';
import { crearRegistroPorCambioDeEstado } from './redis.js';

const PREFIJO = 'sesion:version:';
// Margen sobre la vida del access token: cubre la diferencia de reloj entre las réplicas.
const MARGEN_SEG = 60;
export const VIGENCIA_VERSION_SEG = VIGENCIA_ACCESO_SEG + MARGEN_SEG;

// Solo sube: dos publicaciones que lleguen desordenadas (por ejemplo, desactivar y cambiar el rol casi a
// la vez) nunca dejan en Redis una versión menor que la de la base.
const PUBLICAR_SI_NO_BAJA = `
local actual = tonumber(redis.call('GET', KEYS[1]))
if actual == nil or actual <= tonumber(ARGV[1]) then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
end
return 1`;

const clave = (idUsuario: number): string => `${PREFIJO}${String(idUsuario)}`;

/**
 * A-07, N-15: la versión de sesión vigente vive en Redis lo que dura un access token más un margen.
 * Redis solo guarda lo que se puede perder (RNF-2): la versión real está en Usuario.VersionSesion y los
 * refresh tokens ya quedaron revocados en SQL Server.
 */
export function crearVersionesSesionRedis(
  cliente: Pick<Redis, 'eval' | 'get'>,
  logger: Logger,
): VersionesSesion {
  const registro = crearRegistroPorCambioDeEstado(logger, 'versiones de sesión');
  return {
    async vigente(idUsuario) {
      try {
        const valor = await cliente.get(clave(idUsuario));
        registro.exito();
        return valor === null ? null : Number(valor);
      } catch (error) {
        // N-15: sin Redis el riesgo queda acotado a la ventana del access token.
        registro.fallo(error);
        return null;
      }
    },

    async publicar(idUsuario, versionSesion) {
      try {
        await cliente.eval(
          PUBLICAR_SI_NO_BAJA,
          1,
          clave(idUsuario),
          versionSesion,
          VIGENCIA_VERSION_SEG,
        );
        registro.exito();
      } catch (error) {
        // Cada falla se registra con el usuario: su access token anterior sirve hasta que venza.
        logger.warn(
          { err: error, idUsuario },
          'No se pudo publicar la versión de sesión: su access token anterior vence en 15 min',
        );
      }
    },
  };
}
