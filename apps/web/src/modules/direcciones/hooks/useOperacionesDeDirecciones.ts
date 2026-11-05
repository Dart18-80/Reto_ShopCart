import type { ActualizarDireccion, CrearDireccion } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarDireccion, crearDireccion, eliminarDireccion } from '../direcciones.api';
import { direccionesKeys } from '../direcciones.keys';

/**
 * Crear, editar o eliminar una dirección puede cambiar otras (la predeterminada es una sola, N-17): se vuelve a
 * pedir la lista que confirma el backend, sin suponer el resultado.
 */
function useMutacionDeDirecciones<Datos, Respuesta>(
  operacion: (datos: Datos) => Promise<Respuesta>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: direccionesKeys.lista() }),
  });
}

export const useCrearDireccion = () =>
  useMutacionDeDirecciones((direccion: CrearDireccion) => crearDireccion(direccion));

export const useActualizarDireccion = (idDireccion: number) =>
  useMutacionDeDirecciones((cambios: ActualizarDireccion) =>
    actualizarDireccion(idDireccion, cambios),
  );

export const useEliminarDireccion = (idDireccion: number) =>
  useMutacionDeDirecciones((_sinDatos: undefined) => eliminarDireccion(idDireccion));
