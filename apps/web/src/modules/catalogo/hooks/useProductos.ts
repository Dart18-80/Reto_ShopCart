import type { ConsultaBusqueda } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buscarProductos } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

/** FE-06: al cambiar un filtro o la página se conserva la cuadrícula anterior mientras llega la nueva. */
export function useProductos(consulta: ConsultaBusqueda) {
  return useQuery({
    queryKey: catalogoKeys.busqueda(consulta),
    queryFn: () => buscarProductos(consulta),
    placeholderData: keepPreviousData,
  });
}
