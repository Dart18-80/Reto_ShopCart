import type { CambiarEstadoPedido, CancelarPedido } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cambiarEstadoPedido, cancelarPedidoGestion } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';

// La respuesta trae el pedido sin los campos de la gestión (transiciones, devolvible): se vuelve a pedir el
// detalle de la gestión y la lista, y se olvida el detalle del Cliente si estaba en caché.
function useRefrescarPedido(idPedido: number) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: pedidosKeys.detalleGestion(idPedido) });
    void queryClient.invalidateQueries({ queryKey: pedidosKeys.listasGestion() });
    void queryClient.invalidateQueries({ queryKey: pedidosKeys.detalle(idPedido) });
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
