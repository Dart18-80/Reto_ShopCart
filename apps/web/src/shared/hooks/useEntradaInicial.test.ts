import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEntradaInicial } from './useEntradaInicial';

// Las filas y las barras entran animadas solo la primera vez: lo que llega después aparece sin animar.

describe('useEntradaInicial', () => {
  it('está vigente mientras el contenido es el del primer render', () => {
    const { result, rerender } = renderHook(({ firma }) => useEntradaInicial(firma), {
      initialProps: { firma: '1|2|3' },
    });
    expect(result.current).toBe(true);

    rerender({ firma: '1|2|3' });

    expect(result.current).toBe(true);
  });

  it('deja de estarlo en cuanto cambia el contenido, también si después vuelve al inicial', () => {
    const { result, rerender } = renderHook(({ firma }) => useEntradaInicial(firma), {
      initialProps: { firma: '1|2|3' },
    });

    rerender({ firma: '4|5|6' });
    expect(result.current).toBe(false);

    rerender({ firma: '1|2|3' });
    expect(result.current).toBe(false);
  });
});
