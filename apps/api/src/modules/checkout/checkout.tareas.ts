import type { Tarea } from '../../shared/jobs/index.js';
import type { ConciliacionService } from './checkout.conciliacion.js';
import type { CheckoutRepository } from './checkout.repository.js';

// 01 §8: la expiración de sesiones y la conciliación de pagos corren cada minuto.
const UN_MINUTO_MS = 60_000;

/** A-04: las tareas periódicas del checkout (las arranca server.ts). */
export function tareasCheckout(
  repositorio: Pick<CheckoutRepository, 'expirarSesiones'>,
  conciliacion: ConciliacionService,
): Tarea[] {
  return [
    {
      nombre: 'Checkout.ExpirarSesiones',
      intervaloMs: UN_MINUTO_MS,
      async ejecutar() {
        const sesionesExpiradas = await repositorio.expirarSesiones();
        return sesionesExpiradas === null ? null : { sesionesExpiradas };
      },
    },
    {
      nombre: 'Checkout.ConciliarPagos',
      intervaloMs: UN_MINUTO_MS,
      ejecutar: () => conciliacion.conciliar(),
    },
  ];
}
