import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  animacionDeEntrada,
  animacionDeRebote,
  useAnimarEntrada,
  useReboteAlSubir,
} from './useMovimiento';

// D2: el movimiento respeta `prefers-reduced-motion: reduce`: solo fundidos de 100 ms o menos, sin transformaciones.

const conTransformacion = (fotogramas: Keyframe[]) =>
  fotogramas.some(
    (fotograma) =>
      'transform' in fotograma ||
      'scale' in fotograma ||
      'translate' in fotograma ||
      'top' in fotograma,
  );

function simularMovimiento({ reducido }: { reducido: boolean }) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: reducido && consulta === '(prefers-reduced-motion: reduce)',
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** jsdom no implementa animate(): se espía en el prototipo para ver qué se pidió. */
function espiarAnimate() {
  const animate = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  return animate;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

describe('animaciones con nombre (D2)', () => {
  it('la entrada de página sube 8 px con fundido en 200 ms', () => {
    const { fotogramas, opciones } = animacionDeEntrada(false);

    expect(fotogramas[0]).toEqual({ opacity: 0, top: '8px' });
    expect(opciones.duration).toBe(200);
  });

  it('con movimiento reducido la entrada es solo un fundido de 100 ms o menos', () => {
    const { fotogramas, opciones } = animacionDeEntrada(true);

    expect(conTransformacion(fotogramas)).toBe(false);
    expect(Number(opciones.duration)).toBeLessThanOrEqual(100);
  });

  it('con movimiento reducido la insignia no rebota', () => {
    expect(animacionDeRebote(true)).toBeNull();
    expect(animacionDeRebote(false)?.opciones.duration).toBe(300);
  });
});

function Pagina({ ruta }: { ruta: string }) {
  const ref = useAnimarEntrada<HTMLElement>(ruta);
  return <main ref={ref} />;
}

describe('useAnimarEntrada (D2)', () => {
  it('con movimiento reducido no pide transformaciones', () => {
    simularMovimiento({ reducido: true });
    const animate = espiarAnimate();

    render(<Pagina ruta="/carrito" />);

    expect(animate).toHaveBeenCalledTimes(1);
    expect(conTransformacion(animate.mock.calls[0]?.[0] as Keyframe[])).toBe(false);
  });

  it('anima al cambiar el pathname y no al volver a renderizar con el mismo', () => {
    simularMovimiento({ reducido: false });
    const animate = espiarAnimate();

    const { rerender } = render(<Pagina ruta="/" />);
    rerender(<Pagina ruta="/" />);
    rerender(<Pagina ruta="/carrito" />);

    expect(animate).toHaveBeenCalledTimes(2);
  });
});

function Insignia({ unidades }: { unidades: number | undefined }) {
  const ref = useReboteAlSubir<HTMLSpanElement>(unidades);
  return <span ref={ref} />;
}

describe('useReboteAlSubir (D2)', () => {
  it('rebota cuando la cantidad sube, no al conocerla ni cuando baja', () => {
    simularMovimiento({ reducido: false });
    const animate = espiarAnimate();

    const { rerender } = render(<Insignia unidades={undefined} />);
    rerender(<Insignia unidades={2} />);
    expect(animate).not.toHaveBeenCalled();

    rerender(<Insignia unidades={3} />);
    expect(animate).toHaveBeenCalledTimes(1);

    rerender(<Insignia unidades={1} />);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('con movimiento reducido no rebota', () => {
    simularMovimiento({ reducido: true });
    const animate = espiarAnimate();

    const { rerender } = render(<Insignia unidades={1} />);
    rerender(<Insignia unidades={2} />);

    expect(animate).not.toHaveBeenCalled();
  });
});
