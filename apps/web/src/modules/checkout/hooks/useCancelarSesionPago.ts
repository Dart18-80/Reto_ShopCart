import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelarSesion } from '../checkout.api';
import { checkoutKeys } from '../checkout.keys';

/**
 * «Cambiar dirección o envío» y «Volver a empezar»: cancela la sesión (el backend libera las reservas y el cupón)
 * y la caché queda sin sesión, así `/checkout` muestra otra vez el primer paso.
 */
export function useCancelarSesionPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelarSesion,
    onSuccess: () => {
      queryClient.setQueryData(checkoutKeys.sesion(), null);
    },
  });
}
