import { useEffect, useState, type RefObject } from 'react';

/**
 * Si el contenido (la tabla) es más ancho que su contenedor: entonces necesita su scroll horizontal y su encabezado
 * no puede quedarse fijo respecto a la ventana (un contenedor con scroll ancla lo `sticky` a sí mismo). Se vuelve a
 * medir cuando cambia el tamaño de cualquiera de los dos. Sin ResizeObserver (jsdom), se supone que cabe.
 */
export function useDesbordaAncho(
  contenedor: RefObject<HTMLElement | null>,
  contenido: RefObject<HTMLElement | null>,
): boolean {
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const afuera = contenedor.current;
    const adentro = contenido.current;
    if (!afuera || !adentro || typeof ResizeObserver !== 'function') return;
    const medir = () => {
      setDesborda(adentro.offsetWidth > afuera.clientWidth);
    };
    const observador = new ResizeObserver(medir);
    observador.observe(afuera);
    observador.observe(adentro);
    medir();
    return () => {
      observador.disconnect();
    };
  }, [contenedor, contenido]);
  return desborda;
}
