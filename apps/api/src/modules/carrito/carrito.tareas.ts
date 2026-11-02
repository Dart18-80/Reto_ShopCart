import type { Tarea } from '../../shared/jobs/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { CarritoRepository } from './carrito.repository.js';

// 01 §8: la expiración de los carritos de invitado corre cada hora.
const UNA_HORA_MS = 3_600_000;

/** A-04: las tareas periódicas del carrito (las arranca server.ts). */
export function tareasCarrito(
  repositorio: Pick<CarritoRepository, 'expirarInvitados'>,
  reportes: InvalidadorReportes,
): Tarea[] {
  return [
    {
      nombre: 'Carrito.ExpirarInvitados',
      intervaloMs: UNA_HORA_MS,
      // Una réplica que se reinicia más seguido que cada hora también la ejecuta (con su sp_getapplock).
      alIniciar: true,
      async ejecutar() {
        const carritosExpirados = await repositorio.expirarInvitados();
        if (carritosExpirados === null) return null;
        // A-11: un carrito expirado deja de contar como abandonado.
        if (carritosExpirados > 0) await reportes.invalidar();
        return { carritosExpirados };
      },
    },
  ];
}
