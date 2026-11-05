import { useQuery } from '@tanstack/react-query';
import { obtenerSesion } from '../checkout.api';
import { checkoutKeys } from '../checkout.keys';

/** La sesión de pago Activa (o `null`): al recargar, dice en qué paso del checkout va el Cliente (05 §6). */
export function useSesionPago() {
  return useQuery({ queryKey: checkoutKeys.sesion(), queryFn: obtenerSesion });
}
