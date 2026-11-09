import type { CancelarPedido } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelarPedido } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';
import { guardarRespuesta, refrescar } from '../../../shared/api';

/**
 * M5-H02: sin optimismo, el detalle queda con el pedido que responde el backend y la lista se vuelve a pedir. Un
 * 409 NO_CANCELABLE (el Operador lo despachó mientras tanto) vuelve a consultar el pedido para mostrar su estado.
 */
export function useCancelarPedido(idPedido: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CancelarPedido) => cancelarPedido(idPedido, cuerpo),
    onSuccess: async ({ pedido }) => {
      await guardarRespuesta(queryClient, pedidosKeys.detalle(idPedido), pedido);
      void refrescar(queryClient, { queryKey: pedidosKeys.listas() });
    },
    onError: (error) => {
      if (error.codigo === 'NO_CANCELABLE') {
        void refrescar(queryClient, { queryKey: pedidosKeys.detalle(idPedido) });
      }
    },
  });
}
