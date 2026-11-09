import { QueryClient, type InvalidateQueryFilters, type QueryKey } from '@tanstack/react-query';
import { ErrorApi } from './ErrorApi';

export const REINTENTOS_MAXIMOS = 2;

/** FE-02: solo se reintenta lo que puede funcionar a la segunda (red y 5xx); un 4xx es una regla de negocio. */
export function debeReintentar(reintentosHechos: number, error: unknown): boolean {
  if (reintentosHechos >= REINTENTOS_MAXIMOS) return false;
  return error instanceof ErrorApi && (error.esDeRed || error.status >= 500);
}

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // FE-02 ✏️: sin red la petición sale igual y falla con ErrorApi de red, que la vista muestra con Reintentar.
      // Con el modo por defecto ('online') se pausaría en silencio: un esqueleto o un botón deshabilitados sin fin.
      queries: { retry: debeReintentar, networkMode: 'always' },
      // FE-02: una mutación nunca se reintenta sola; el pago tiene su propia idempotencia (RF-06).
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

/**
 * FE-02: vuelve a pedir lo que una mutación cambió. Primero cancela la lectura que esté en vuelo: si empezó antes de
 * que el backend confirmara el cambio, TanStack la reutilizaría (las peticiones no se abortan) y la vista quedaría
 * con los datos viejos. Todo hook de mutación refresca a través de aquí, no con `invalidateQueries`.
 */
export async function refrescar(queryClient: QueryClient, filtros: InvalidateQueryFilters) {
  await queryClient.cancelQueries(filtros);
  await queryClient.invalidateQueries(filtros);
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ErrorApi;
  }
}

/**
 * FE-02: una mutación que responde el dato completo (el carrito, la sesión de pago, el pedido) lo deja en la caché.
 * Antes cancela la lectura de esa llave que esté en vuelo: si empezó antes de la mutación, al terminar pisaría la
 * respuesta con datos viejos. Todo hook de mutación escribe en la caché a través de aquí, no con `setQueryData`.
 */
export async function guardarRespuesta(
  queryClient: QueryClient,
  queryKey: QueryKey,
  datos: unknown,
) {
  await queryClient.cancelQueries({ queryKey, exact: true });
  queryClient.setQueryData(queryKey, datos);
}
