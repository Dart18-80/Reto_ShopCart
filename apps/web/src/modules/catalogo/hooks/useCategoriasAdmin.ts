import type { ActualizarCategoria, CrearCategoria } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarCategoria,
  cambiarCategoria,
  crearCategoria,
  listarCategoriasAdmin,
  type AccionCategoria,
} from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';
import { refrescar } from '../../../shared/api';

export function useCategoriasAdmin() {
  return useQuery({ queryKey: catalogoKeys.categoriasAdmin(), queryFn: listarCategoriasAdmin });
}

/**
 * Toda operación sobre una categoría vuelve a pedir la lista del Admin y la de la tienda (sus chips): el backend
 * confirma el resultado, sin optimismo.
 */
function useMutacionDeCategorias<Datos>(operacion: (datos: Datos) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: async () => {
      await Promise.all([
        refrescar(queryClient, { queryKey: catalogoKeys.categoriasAdmin() }),
        refrescar(queryClient, { queryKey: catalogoKeys.categorias() }),
      ]);
    },
  });
}

export const useCrearCategoria = () =>
  useMutacionDeCategorias((cuerpo: CrearCategoria) => crearCategoria(cuerpo));

export const useActualizarCategoria = (idCategoria: number) =>
  useMutacionDeCategorias((cambios: ActualizarCategoria) =>
    actualizarCategoria(idCategoria, cambios),
  );

export const useCambiarCategoria = () =>
  useMutacionDeCategorias(
    ({ idCategoria, accion }: { idCategoria: number; accion: AccionCategoria }) =>
      cambiarCategoria(idCategoria, accion),
  );
