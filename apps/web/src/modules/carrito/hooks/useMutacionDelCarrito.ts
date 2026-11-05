import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Carrito } from '../carrito.api';
import { carritoKeys } from '../carrito.keys';

/**
 * Toda operación del carrito responde el carrito completo: la caché toma esa respuesta, nunca una suposición
 * (sin actualizaciones optimistas: el SP decide existencia, precios y avisos, A-02).
 */
export function useMutacionDelCarrito<Datos>(operacion: (datos: Datos) => Promise<Carrito>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: (carrito) => {
      queryClient.setQueryData(carritoKeys.carrito(), carrito);
    },
  });
}
