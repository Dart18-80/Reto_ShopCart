import { useMutation, useQueryClient } from '@tanstack/react-query';
import { guardarRespuesta } from '../../../shared/api';
import type { Carrito } from '../carrito.api';
import { carritoKeys } from '../carrito.keys';

/**
 * Toda operación del carrito responde el carrito completo: la caché toma esa respuesta, nunca una suposición
 * (sin actualizaciones optimistas: el SP decide existencia, precios y avisos, A-02). Los cambios van en fila (`scope`):
 * con dos filas cambiando a la vez, la respuesta de la primera no puede llegar después y pisar la de la segunda.
 */
export function useMutacionDelCarrito<Datos>(operacion: (datos: Datos) => Promise<Carrito>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    scope: { id: 'carrito' },
    onSuccess: (carrito) => guardarRespuesta(queryClient, carritoKeys.carrito(), carrito),
  });
}
