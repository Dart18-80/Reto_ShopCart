import { useQuery } from '@tanstack/react-query';
import { obtenerProducto } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

export function useProducto(idProducto: number) {
  return useQuery({
    queryKey: catalogoKeys.producto(idProducto),
    queryFn: () => obtenerProducto(idProducto),
  });
}
