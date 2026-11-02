import type { Rol } from '../../shared/http/index.js';
import type { EstadoPedido } from './pedidos.types.js';

/** Por dónde se alcanza cada transición (N-08): solo las de Gestion se piden con el endpoint de estado. */
export type ViaTransicion = 'Gestion' | 'Cancelacion' | 'Devolucion';

export interface Transicion {
  origen: EstadoPedido;
  destino: EstadoPedido;
  roles: readonly Rol[];
  via: ViaTransicion;
}

const GESTION: readonly Rol[] = ['Operador', 'Administrador'];
const QUIENES_CANCELAN: readonly Rol[] = ['Cliente', 'Operador', 'Administrador'];

/**
 * N-08, primera capa: el mapa de transiciones del pedido. La segunda capa es TransicionEstadoPedido con
 * TR_Pedidos_ValidarTransicion; una prueba verifica que ambos coinciden, rol por rol. Una transición nueva
 * se agrega aquí y en la tabla.
 */
export const TRANSICIONES: readonly Transicion[] = [
  { origen: 'Pagado', destino: 'EnPreparacion', roles: GESTION, via: 'Gestion' },
  { origen: 'EnPreparacion', destino: 'Despachado', roles: GESTION, via: 'Gestion' },
  { origen: 'Despachado', destino: 'Entregado', roles: GESTION, via: 'Gestion' },
  { origen: 'Pagado', destino: 'Cancelado', roles: QUIENES_CANCELAN, via: 'Cancelacion' },
  { origen: 'EnPreparacion', destino: 'Cancelado', roles: QUIENES_CANCELAN, via: 'Cancelacion' },
  // Solo las deriva el SP de devoluciones a partir de lo devuelto, nunca el endpoint de estado.
  { origen: 'Entregado', destino: 'DevueltoParcial', roles: GESTION, via: 'Devolucion' },
  { origen: 'Entregado', destino: 'Devuelto', roles: GESTION, via: 'Devolucion' },
  { origen: 'DevueltoParcial', destino: 'Devuelto', roles: GESTION, via: 'Devolucion' },
];

/** ¿Puede este rol pedir esta transición por la vía dada? */
export function transicionPermitida(
  origen: EstadoPedido,
  destino: EstadoPedido,
  rol: Rol,
  via: ViaTransicion,
): boolean {
  return TRANSICIONES.some(
    (t) => t.origen === origen && t.destino === destino && t.via === via && t.roles.includes(rol),
  );
}
