import { useQuery } from '@tanstack/react-query';
import { obtenerCarrito } from '../carrito.api';
import { carritoKeys } from '../carrito.keys';

/** El carrito de quien navega: el invitado por su cookie, el Cliente por su sesión (N-05). El personal no tiene. */
export function useCarrito({ habilitado = true }: { habilitado?: boolean } = {}) {
  return useQuery({
    queryKey: carritoKeys.carrito(),
    queryFn: obtenerCarrito,
    enabled: habilitado,
  });
}
