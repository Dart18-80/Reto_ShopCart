import type { ActualizarMetodoEnvio } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarMetodoEnvio, listarMetodosAdmin } from '../envios.api';
import { enviosKeys } from '../envios.keys';
import { refrescar } from '../../../shared/api';

export function useMetodosAdmin() {
  return useQuery({ queryKey: enviosKeys.admin(), queryFn: listarMetodosAdmin });
}

/** Sin optimismo: al responder se vuelven a pedir los métodos, los del Admin y los del carrito (su costo cambió). */
export function useActualizarMetodoEnvio(idMetodoEnvio: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: ActualizarMetodoEnvio) => actualizarMetodoEnvio(idMetodoEnvio, cuerpo),
    onSuccess: () => refrescar(queryClient, { queryKey: enviosKeys.todo }),
  });
}
