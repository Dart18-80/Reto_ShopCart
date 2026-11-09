import type { CambiarEstadoPedido, CancelarPedido, RegistrarDevolucion } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cambiarEstadoPedido, cancelarPedidoGestion, registrarDevolucion } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';
import { refrescar } from '../../../shared/api';

// La respuesta trae el pedido sin los campos de la gestión (transiciones, devolvible): se vuelve a pedir el
// detalle de la gestión y la lista, y se olvida el detalle del Cliente si estaba en caché.
function useRefrescarPedido(idPedido: number) {
  const queryClient = useQueryClient();
  return () => {
    void refrescar(queryClient, { queryKey: pedidosKeys.detalleGestion(idPedido) });
    void refrescar(queryClient, { queryKey: pedidosKeys.listasGestion() });
    void refrescar(queryClient, { queryKey: pedidosKeys.detalle(idPedido) });
  };
}

/**
 * M8-H03 (N-08): sin optimismo; el detalle muestra lo que confirmó el backend. Un 409 CONFLICTO_CONCURRENCIA (otra
 * persona lo movió mientras tanto) vuelve a consultar el pedido para mostrar su estado actual.
 */
export function useCambiarEstadoPedido(idPedido: number) {
  const refrescar = useRefrescarPedido(idPedido);
  return useMutation({
    mutationFn: (cambio: CambiarEstadoPedido) => cambiarEstadoPedido(idPedido, cambio),
    onSuccess: refrescar,
    onError: (error) => {
      if (error.codigo === 'CONFLICTO_CONCURRENCIA') refrescar();
    },
  });
}

/** M8-H03 (N-09): un 409 NO_CANCELABLE también vuelve a consultar el pedido. */
export function useCancelarPedidoGestion(idPedido: number) {
  const refrescar = useRefrescarPedido(idPedido);
  return useMutation({
    mutationFn: (cuerpo: CancelarPedido) => cancelarPedidoGestion(idPedido, cuerpo),
    onSuccess: refrescar,
    onError: (error) => {
      if (error.codigo === 'NO_CANCELABLE') refrescar();
    },
  });
}

// Lo que el backend rechaza porque el pedido cambió (otra devolución, el plazo venció): se vuelve a consultar
// para que el diálogo muestre lo devolvible de ahora.
const RECHAZOS_DE_DEVOLUCION = new Set(['DEVOLUCION_EXCEDE_VENDIDO', 'PLAZO_DEVOLUCION_VENCIDO']);

/** M8-H04 (N-10): sin optimismo; el reingreso al inventario y el reembolso los hace el SP en una transacción. */
export function useRegistrarDevolucion(idPedido: number) {
  const refrescar = useRefrescarPedido(idPedido);
  return useMutation({
    mutationFn: (devolucion: RegistrarDevolucion) => registrarDevolucion(idPedido, devolucion),
    onSuccess: refrescar,
    onError: (error) => {
      if (RECHAZOS_DE_DEVOLUCION.has(error.codigo)) refrescar();
    },
  });
}
