import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesbordaAncho } from './useDesbordaAncho';

// D6: el encabezado de una tabla solo se fija a la ventana si la tabla cabe a lo ancho; si no, su contenedor
// necesita el scroll horizontal.

let avisarCambio: () => void = () => undefined;

class ResizeObserverFalso {
  constructor(avisar: () => void) {
    avisarCambio = avisar;
  }
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

function medidas(
  elemento: HTMLElement,
  propiedad: 'offsetWidth' | 'clientWidth',
  valor: () => number,
) {
  Object.defineProperty(elemento, propiedad, { configurable: true, get: valor });
}

function Tabla({
  anchoTabla,
  anchoContenedor,
}: {
  anchoTabla: () => number;
  anchoContenedor: () => number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const tabla = useRef<HTMLTableElement>(null);
  const desborda = useDesbordaAncho(contenedor, tabla);
  return (
    <div
      ref={(el) => {
        contenedor.current = el;
        if (el) medidas(el, 'clientWidth', anchoContenedor);
      }}
    >
      <table
        ref={(el) => {
          tabla.current = el;
          if (el) medidas(el, 'offsetWidth', anchoTabla);
        }}
      />
      <p>{desborda ? 'desborda' : 'cabe'}</p>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDesbordaAncho (D6)', () => {
  it('una tabla tan ancha como su contenedor cabe', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFalso);

    render(<Tabla anchoTabla={() => 800} anchoContenedor={() => 800} />);

    expect(screen.getByText('cabe')).toBeInTheDocument();
  });

  it('una tabla más ancha que su contenedor desborda, y deja de hacerlo si el contenedor crece', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
    let contenedor = 700;

    render(<Tabla anchoTabla={() => 900} anchoContenedor={() => contenedor} />);
    expect(screen.getByText('desborda')).toBeInTheDocument();

    contenedor = 1000;
    act(() => {
      avisarCambio();
    });
    expect(screen.getByText('cabe')).toBeInTheDocument();
  });

  it('sin ResizeObserver (jsdom), se supone que cabe', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    render(<Tabla anchoTabla={() => 900} anchoContenedor={() => 700} />);

    expect(screen.getByText('cabe')).toBeInTheDocument();
  });
});
