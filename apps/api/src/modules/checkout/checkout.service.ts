import { AppError } from '../../shared/errors/index.js';
import type { CheckoutRepository } from './checkout.repository.js';
import type { DatosInicioPago, SesionIniciada, SesionPago } from './checkout.types.js';

interface Dependencias {
  repositorio: Pick<CheckoutRepository, 'iniciarSesion' | 'obtenerSesion' | 'cancelarSesion'>;
}

export function crearCheckoutService({ repositorio }: Dependencias) {
  return {
    // N-06, N-12, 01 §6.1: el SP decide todo bajo bloqueo (reutilizar o crear, todo o nada, cupón).
    iniciarSesion: (datos: DatosInicioPago): Promise<SesionIniciada> =>
      repositorio.iniciarSesion(datos),

    async obtenerSesion(): Promise<SesionPago> {
      const sesion = await repositorio.obtenerSesion();
      if (sesion === null)
        throw new AppError('NO_ENCONTRADO', { mensaje: 'No tienes un pago en curso.' });
      return sesion;
    },

    cancelarSesion: (): Promise<void> => repositorio.cancelarSesion(),
  };
}

export type CheckoutService = ReturnType<typeof crearCheckoutService>;
