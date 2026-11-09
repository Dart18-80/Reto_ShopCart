import type { ActualizarUsuario, ConsultaUsuarios, CrearUsuarioInterno } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuarioInterno,
  listarUsuarios,
  type AccionUsuario,
} from '../usuarios.api';
import { usuariosKeys } from '../usuarios.keys';

export function useUsuarios(consulta: ConsultaUsuarios) {
  return useQuery({
    queryKey: usuariosKeys.lista(consulta),
    queryFn: () => listarUsuarios(consulta),
    placeholderData: keepPreviousData,
  });
}

/** Sin optimismo: cada cambio vuelve a pedir la lista y muestra lo que confirmó el backend. */
function useMutacionDeUsuarios<Datos, Respuesta>(operacion: (datos: Datos) => Promise<Respuesta>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usuariosKeys.listas() }),
  });
}

export const useCrearUsuario = () =>
  useMutacionDeUsuarios((datos: CrearUsuarioInterno) => crearUsuarioInterno(datos));

export const useActualizarUsuario = (idUsuario: number) =>
  useMutacionDeUsuarios((cambios: ActualizarUsuario) => actualizarUsuario(idUsuario, cambios));

export const useCambiarEstadoUsuario = () =>
  useMutacionDeUsuarios(({ idUsuario, accion }: { idUsuario: number; accion: AccionUsuario }) =>
    cambiarEstadoUsuario(idUsuario, accion),
  );
