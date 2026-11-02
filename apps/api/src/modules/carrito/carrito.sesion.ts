import type { Logger } from 'pino';
import { hashearTokenOpaco } from '../../shared/http/index.js';
import type { CarritoRepository } from './carrito.repository.js';
import type { AvisoFusion } from './carrito.types.js';

interface Dependencias {
  repositorio: Pick<CarritoRepository, 'fusionar' | 'asignarInvitado'>;
  logger: Logger;
}

/**
 * N-05: el carrito de invitado cuando el cliente abre sesión; corre como ese cliente. Si la fusión o la
 * asignación fallan, la sesión se abre igual, la cookie se conserva y el error se registra con su causa. Un
 * error dentro de la transacción la revierte completa (el carrito de invitado queda intacto). Nunca se
 * registra el token.
 */
export function crearCarritoDeInvitado({ repositorio, logger }: Dependencias) {
  return {
    /** Al iniciar sesión. null si falló. */
    async fusionar(tokenInvitado: string): Promise<AvisoFusion[] | null> {
      try {
        return await repositorio.fusionar(hashearTokenOpaco(tokenInvitado));
      } catch (error) {
        logger.error({ err: error }, 'No se pudo fusionar el carrito de invitado');
        return null;
      }
    },

    /** Al registrarse. false si falló. */
    async asignar(tokenInvitado: string): Promise<boolean> {
      try {
        await repositorio.asignarInvitado(hashearTokenOpaco(tokenInvitado));
        return true;
      } catch (error) {
        logger.error({ err: error }, 'No se pudo asignar el carrito de invitado');
        return false;
      }
    },
  };
}

export type CarritoDeInvitado = ReturnType<typeof crearCarritoDeInvitado>;
