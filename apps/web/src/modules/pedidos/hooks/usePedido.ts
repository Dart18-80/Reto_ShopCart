import { useQuery } from '@tanstack/react-query';
import { obtenerPedido } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';

export function usePedido(idPedido: number) {
  return useQuery({
    queryKey: pedidosKeys.detalle(idPedido),
    queryFn: () => obtenerPedido(idPedido),
  });
}
