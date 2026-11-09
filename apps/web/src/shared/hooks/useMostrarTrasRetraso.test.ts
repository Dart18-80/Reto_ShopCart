import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRASO_ESQUELETO_MS, useMostrarTrasRetraso } from './useMostrarTrasRetraso';

// D3: el esqueleto aparece solo si la carga pasa de 150 ms.
describe('useMostrarTrasRetraso (D3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('el retraso del esqueleto es de 150 ms', () => {
    expect(RETRASO_ESQUELETO_MS).toBe(150);
  });

  it('antes de 150 ms no se muestra', () => {
    const { result } = renderHook(() => useMostrarTrasRetraso());

    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(result.current).toBe(false);
  });

  it('a los 150 ms se muestra', () => {
    const { result } = renderHook(() => useMostrarTrasRetraso());

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe(true);
  });

  it('si quien lo usa se desmonta antes, no queda un temporizador pendiente', () => {
    const { unmount } = renderHook(() => useMostrarTrasRetraso());

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
