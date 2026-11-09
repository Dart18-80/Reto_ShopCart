import type { ConsultaProductosAdmin, CrearProducto } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearProducto, listarProductosAdmin } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';
import { refrescar } from '../../../shared/api';

/** FE-06: al cambiar un filtro, el orden o la página se conserva la tabla anterior mientras llega la nueva. */
export function useProductosAdmin(consulta: ConsultaProductosAdmin) {
  return useQuery({
    queryKey: catalogoKeys.listaProductosAdmin(consulta),
    queryFn: () => listarProductosAdmin(consulta),
    placeholderData: keepPreviousData,
  });
}

/** El producto nuevo deja vieja la tabla; la página decide a dónde ir con el que responde el backend. */
export function useCrearProducto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CrearProducto) => crearProducto(cuerpo),
    onSuccess: () => refrescar(queryClient, { queryKey: catalogoKeys.productosAdmin() }),
  });
}
