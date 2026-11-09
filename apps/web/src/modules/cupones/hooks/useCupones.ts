import type { ActualizarCupon, ConsultaCupones, CrearCupon } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarCupon,
  cambiarEstadoCupon,
  crearCupon,
  listarCupones,
  type AccionCupon,
} from '../cupones.api';
import { cuponesKeys } from '../cupones.keys';

export function useCupones(consulta: ConsultaCupones) {
  return useQuery({
    queryKey: cuponesKeys.lista(consulta),
    queryFn: () => listarCupones(consulta),
    placeholderData: keepPreviousData,
  });
}

/** Sin optimismo: toda operación vuelve a pedir la lista y muestra lo que confirmó el backend. */
function useMutacionDeCupones<Datos, Respuesta>(operacion: (datos: Datos) => Promise<Respuesta>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cuponesKeys.todo }),
  });
}

export const useCrearCupon = () => useMutacionDeCupones((cuerpo: CrearCupon) => crearCupon(cuerpo));

export const useActualizarCupon = (idCupon: number) =>
  useMutacionDeCupones((cambios: ActualizarCupon) => actualizarCupon(idCupon, cambios));

export const useCambiarEstadoCupon = () =>
  useMutacionDeCupones(({ idCupon, accion }: { idCupon: number; accion: AccionCupon }) =>
    cambiarEstadoCupon(idCupon, accion),
  );
