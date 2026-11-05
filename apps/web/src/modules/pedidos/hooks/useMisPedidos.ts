import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listarMisPedidos, type ConsultaMisPedidos } from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';

/** FE-06: al cambiar de página se conserva la lista anterior mientras llega la nueva. */
export function useMisPedidos(consulta: ConsultaMisPedidos) {
  return useQuery({
    queryKey: pedidosKeys.lista(consulta),
    queryFn: () => listarMisPedidos(consulta),
    placeholderData: keepPreviousData,
  });
}
