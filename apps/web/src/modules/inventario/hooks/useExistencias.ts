import type { ConsultaExistencias } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listarExistencias, obtenerConciliacion } from '../inventario.api';
import { inventarioKeys } from '../inventario.keys';

/** FE-06: al cambiar la búsqueda, el orden o la página se conserva la tabla anterior mientras llega la nueva. */
export function useExistencias(consulta: ConsultaExistencias) {
  return useQuery({
    queryKey: inventarioKeys.listaExistencias(consulta),
    queryFn: () => listarExistencias(consulta),
    placeholderData: keepPreviousData,
  });
}

/** N-07: las variantes cuya existencia física no coincide con su kardex; vacía es lo esperado. */
export function useConciliacion() {
  return useQuery({
    queryKey: inventarioKeys.conciliacion(),
    queryFn: obtenerConciliacion,
  });
}
