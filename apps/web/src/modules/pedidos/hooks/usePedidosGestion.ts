import type { ConsultaPedidosGestion } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listarPedidosGestion, obtenerPedidoGestion } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';

/** M8-H02: la lista de la gestión; mientras llega otra página o filtro, se queda la anterior (FE-06). */
export function usePedidosGestion(consulta: ConsultaPedidosGestion) {
  return useQuery({
    queryKey: pedidosKeys.listaGestion(consulta),
    queryFn: () => listarPedidosGestion(consulta),
    placeholderData: keepPreviousData,
  });
}

export function usePedidoGestion(idPedido: number) {
  return useQuery({
    queryKey: pedidosKeys.detalleGestion(idPedido),
    queryFn: () => obtenerPedidoGestion(idPedido),
  });
}
