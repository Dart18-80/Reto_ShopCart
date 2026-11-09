import type { ActualizarConfiguracion } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarConfiguracion, obtenerConfiguracion } from '../configuracion.api';
import { configuracionKeys } from '../configuracion.keys';

export function useConfiguracion() {
  return useQuery({ queryKey: configuracionKeys.todo, queryFn: obtenerConfiguracion });
}

/**
 * A-14: un parámetro cambia lo que calculan muchos SPs (la reserva del checkout, la garantía, el envío gratis…).
 * Al guardar se descarta todo lo que hay en caché: lo que se vuelva a ver se pide con los parámetros nuevos.
 */
export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: ActualizarConfiguracion) => actualizarConfiguracion(cambios),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
