import type { ActualizarConfiguracion } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarConfiguracion, obtenerConfiguracion } from '../configuracion.api';
import { configuracionKeys } from '../configuracion.keys';
import { refrescar } from '../../../shared/api';

export function useConfiguracion() {
  return useQuery({ queryKey: configuracionKeys.todo, queryFn: obtenerConfiguracion });
}

/**
 * A-14: un parámetro cambia lo que calculan muchos SPs (la reserva del checkout, la garantía, el envío gratis, el
 * plazo de devolución…). Al guardar se toma la configuración de la respuesta y se descarta el resto de la caché que
 * depende de ella: lo que se vuelva a ver se pide con los parámetros nuevos.
 */
export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cambios: ActualizarConfiguracion) => actualizarConfiguracion(cambios),
    onSuccess: (configuracion) => {
      queryClient.setQueryData(configuracionKeys.todo, configuracion);
      return refrescar(queryClient, {
        // La configuración ya llegó en la respuesta: no se vuelve a pedir.
        predicate: (consulta) => consulta.queryKey[0] !== configuracionKeys.todo[0],
      });
    },
  });
}
