import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRevelarAlEntrar } from './useRevelarAlEntrar';

// Una sección bajo el pliegue recibe `data-visible` una sola vez, al entrar a la vista. Con movimiento reducido, o sin
// IntersectionObserver, ya entra visible: nunca queda oculta esperando un aviso que no va a llegar.

function simularMovimiento({ reducido }: { reducido: boolean }) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta === '(prefers-reduced-motion: reduce)',
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** Un IntersectionObserver falso: guarda el aviso para dispararlo desde la prueba. */
function simularObservador() {
  const observador: {
    avisar: (visible: boolean) => void;
    opciones: IntersectionObserverInit | undefined;
    desconectado: boolean;
  } = { avisar: () => undefined, opciones: undefined, desconectado: false };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(aviso: IntersectionObserverCallback, opciones?: IntersectionObserverInit) {
        observador.opciones = opciones;
        observador.avisar = (visible) => {
          aviso(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
        };
      }
      observe() {
        return undefined;
      }
      disconnect() {
        observador.desconectado = true;
      }
    },
  );
  return observador;
}

function Seccion() {
  const ref = useRevelarAlEntrar<HTMLElement>();
  return (
    <section ref={ref} aria-label="Reporte">
      Contenido
    </section>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useRevelarAlEntrar', () => {
  it('con movimiento reducido la sección ya entra visible, sin esperar al observador', () => {
    simularMovimiento({ reducido: true });
    simularObservador();

    render(<Seccion />);

    expect(screen.getByRole('region', { name: 'Reporte' })).toHaveAttribute('data-visible');
  });

  it('sin IntersectionObserver la sección ya entra visible', () => {
    simularMovimiento({ reducido: false });
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<Seccion />);

    expect(screen.getByRole('region', { name: 'Reporte' })).toHaveAttribute('data-visible');
  });

  it('sin movimiento reducido espera a que el 18 % entre a la vista y deja de observar', () => {
    simularMovimiento({ reducido: false });
    const observador = simularObservador();
    render(<Seccion />);
    const seccion = screen.getByRole('region', { name: 'Reporte' });
    expect(seccion).not.toHaveAttribute('data-visible');
    expect(observador.opciones?.threshold).toBe(0.18);

    act(() => {
      observador.avisar(true);
    });

    expect(seccion).toHaveAttribute('data-visible');
    expect(observador.desconectado).toBe(true);
  });
});
