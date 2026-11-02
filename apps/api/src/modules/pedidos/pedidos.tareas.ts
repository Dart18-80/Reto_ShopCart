import type { Tarea } from '../../shared/jobs/index.js';
import type { ReembolsosService } from './pedidos.reembolsos.js';

// 01 §8, N-09: los reembolsos pendientes se reintentan cada 5 minutos.
const CINCO_MINUTOS_MS = 5 * 60_000;

/** A-04: las tareas periódicas de pedidos (las arranca server.ts). */
export function tareasPedidos(reembolsos: ReembolsosService): Tarea[] {
  return [
    {
      nombre: 'Pedidos.ReintentarReembolsos',
      intervaloMs: CINCO_MINUTOS_MS,
      ejecutar: () => reembolsos.reintentarPendientes(),
    },
  ];
}
