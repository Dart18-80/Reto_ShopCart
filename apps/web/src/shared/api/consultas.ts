import { QueryClient } from '@tanstack/react-query';
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
      queries: { retry: debeReintentar },
      // FE-02: una mutación nunca se reintenta sola; el pago tiene su propia idempotencia (RF-06).
      mutations: { retry: false },
    },
  });
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ErrorApi;
  }
}
