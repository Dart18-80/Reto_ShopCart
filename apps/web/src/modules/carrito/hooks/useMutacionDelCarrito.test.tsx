import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { crearQueryClient } from '../../../shared/api';
import type { Carrito } from '../carrito.api';
import { carritoKeys } from '../carrito.keys';
import { useMutacionDelCarrito } from './useMutacionDelCarrito';

// Solo importa que cada respuesta se distinga; el resto del carrito no se lee aquí.
const carrito = (version: string) => ({ version }) as unknown as Carrito;

describe('useMutacionDelCarrito (revisión de la Fase 2)', () => {
  it('dos cambios en filas distintas van en fila: la caché queda con la respuesta del último', async () => {
    const queryClient = crearQueryClient();
    const envoltorio = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const pendientes: ((respuesta: Carrito) => void)[] = [];
    const operacion = vi.fn(
      () =>
        new Promise<Carrito>((resolver) => {
          pendientes.push(resolver);
        }),
    );
    const { result: primera } = renderHook(() => useMutacionDelCarrito(operacion), {
      wrapper: envoltorio,
    });
    const { result: segunda } = renderHook(() => useMutacionDelCarrito(operacion), {
      wrapper: envoltorio,
    });

    act(() => {
      primera.current.mutate(undefined);
      segunda.current.mutate(undefined);
    });
    await vi.waitFor(() => {
      expect(operacion).toHaveBeenCalledTimes(1);
    });
    // La segunda no sale hasta que el backend respondió la primera.
    await new Promise((resolver) => setTimeout(resolver, 20));
    expect(operacion).toHaveBeenCalledTimes(1);

    pendientes[0]?.(carrito('después del primer cambio'));
    await vi.waitFor(() => {
      expect(operacion).toHaveBeenCalledTimes(2);
    });
    pendientes[1]?.(carrito('después de los dos cambios'));

    await vi.waitFor(() => {
      expect(queryClient.getQueryData(carritoKeys.carrito())).toEqual(
        carrito('después de los dos cambios'),
      );
    });
  });
});
