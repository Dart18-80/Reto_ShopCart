import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { textoDelConteo, useConteoAnimado } from './useConteoAnimado';

// El conteo es decorativo: escala los dígitos del texto ya formateado (sin pasar un monto por `number`, FE-10) y
// termina exactamente en el texto real.

describe('textoDelConteo', () => {
  it('al terminar es el texto real', () => {
    expect(textoDelConteo('Q12,345.67', 1)).toBe('Q12,345.67');
  });

  it('al empezar es cero con el mismo formato', () => {
    expect(textoDelConteo('Q12,345.67', 0)).toBe('Q0.00');
    expect(textoDelConteo('1,532', 0)).toBe('0');
  });

  it('a medio camino escala los dígitos sin ceros ni separadores sobrantes a la izquierda', () => {
    expect(textoDelConteo('Q12,345.60', 0.5)).toBe('Q6,172.80');
    expect(textoDelConteo('1,532', 0.01)).toBe('15');
  });

  it('solo cuenta una cifra sola: con texto alrededor no sabe qué escalar', () => {
    expect(textoDelConteo('-Q120.00(neto con devoluciones)', 0.5)).toBeNull();
    expect(textoDelConteo('Sin datos', 0.5)).toBeNull();
  });
});

function Cifra({ texto }: { texto: string }) {
  const { real, conteo } = useConteoAnimado<HTMLSpanElement>();
  return (
    <span>
      <span ref={real}>{texto}</span>
      <span ref={conteo} aria-hidden data-testid="conteo" />
    </span>
  );
}

describe('useConteoAnimado', () => {
  it('sin animate (jsdom) no cuenta: el texto real queda tal cual y el conteo vacío', () => {
    render(<Cifra texto="Q578.00" />);

    expect(screen.getByText('Q578.00')).toBeVisible();
    // El span del conteo es aria-hidden y no tiene nombre: solo se alcanza por su test id.
    expect(screen.getByTestId('conteo')).toBeEmptyDOMElement();
  });
});
