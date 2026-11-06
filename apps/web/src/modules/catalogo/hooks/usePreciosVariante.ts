import type { DatosPrecio } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cambiarPrecio, historialPrecios } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

/** El historial se pide al abrir el diálogo, no por cada fila de la tabla. */
export function usePreciosVariante(idVariante: number, { habilitado }: { habilitado: boolean }) {
  return useQuery({
    queryKey: catalogoKeys.preciosVariante(idVariante),
    queryFn: () => historialPrecios(idVariante),
    enabled: habilitado,
  });
}

/**
 * M6-H05: el historial queda con el que responde el backend; el producto del editor y la tienda se vuelven a pedir
 * para mostrar el precio vigente nuevo.
 */
export function useCambiarPrecio(idProducto: number, idVariante: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: DatosPrecio) => cambiarPrecio(idVariante, cuerpo),
    onSuccess: async (historial) => {
      queryClient.setQueryData(catalogoKeys.preciosVariante(idVariante), historial);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogoKeys.productoAdmin(idProducto) }),
        queryClient.invalidateQueries({ queryKey: catalogoKeys.busquedas(), refetchType: 'none' }),
        queryClient.invalidateQueries({
          queryKey: catalogoKeys.producto(idProducto),
          refetchType: 'none',
        }),
      ]);
    },
  });
}
