import { useMutation, useQueryClient } from '@tanstack/react-query';
import { guardarRespuesta } from '../../../shared/api';
import { iniciarSesion } from '../checkout.api';
import { checkoutKeys } from '../checkout.keys';

/** «Continuar al pago»: la sesión que crea el backend queda en la caché para el paso de pago (sin optimismo). */
export function useIniciarSesionPago() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: iniciarSesion,
    onSuccess: (sesion) => guardarRespuesta(queryClient, checkoutKeys.sesion(), sesion),
  });
}
