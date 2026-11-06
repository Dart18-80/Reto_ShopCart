import type {
  ActualizarProducto,
  ActualizarVariante,
  DatosVariante,
  GuardarImagenes,
} from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarProducto,
  actualizarVariante,
  cambiarProducto,
  cambiarVariante,
  crearVariante,
  guardarImagenes,
  obtenerProductoAdmin,
  type AccionEstado,
} from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

export function useProductoAdmin(idProducto: number) {
  return useQuery({
    queryKey: catalogoKeys.productoAdmin(idProducto),
    queryFn: () => obtenerProductoAdmin(idProducto),
  });
}

/**
 * M6-H04: toda operación del editor vuelve a pedir el producto y deja vieja la tabla de productos y la tienda
 * (búsqueda y detalle): sin optimismo, la pantalla muestra lo que confirmó el backend.
 */
function useMutacionDelProducto<Datos>(
  idProducto: number,
  operacion: (datos: Datos) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogoKeys.productoAdmin(idProducto) }),
        queryClient.invalidateQueries({
          queryKey: catalogoKeys.productosAdmin(),
          refetchType: 'none',
        }),
        queryClient.invalidateQueries({ queryKey: catalogoKeys.busquedas(), refetchType: 'none' }),
        queryClient.invalidateQueries({
          queryKey: catalogoKeys.producto(idProducto),
          refetchType: 'none',
        }),
      ]);
    },
  });
}

export const useActualizarProducto = (idProducto: number) =>
  useMutacionDelProducto(idProducto, (cambios: ActualizarProducto) =>
    actualizarProducto(idProducto, cambios),
  );

export const useCambiarProducto = (idProducto: number) =>
  useMutacionDelProducto(idProducto, (accion: AccionEstado) => cambiarProducto(idProducto, accion));

export const useGuardarImagenes = (idProducto: number) =>
  useMutacionDelProducto(idProducto, (cuerpo: GuardarImagenes) =>
    guardarImagenes(idProducto, cuerpo),
  );

export const useCrearVariante = (idProducto: number) =>
  useMutacionDelProducto(idProducto, (cuerpo: DatosVariante) => crearVariante(idProducto, cuerpo));

export const useActualizarVariante = (idProducto: number, idVariante: number) =>
  useMutacionDelProducto(idProducto, (cambios: ActualizarVariante) =>
    actualizarVariante(idVariante, cambios),
  );

export const useCambiarVariante = (idProducto: number) =>
  useMutacionDelProducto(
    idProducto,
    ({ idVariante, accion }: { idVariante: number; accion: AccionEstado }) =>
      cambiarVariante(idVariante, accion),
  );
