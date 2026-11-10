import { useCallback, type RefCallback } from 'react';
import { useMovimientoReducido } from './useMovimiento';

// La fracción de la sección que tiene que estar a la vista para revelarla.
const UMBRAL_VISIBLE = 0.18;
const ATRIBUTO = 'data-visible';

/**
 * Marca el elemento con `data-visible` la primera vez que entra a la vista (la utilidad `revelar-al-entrar` lo hace
 * subir con fundido). Solo para secciones bajo el pliegue: lo que se ve al cargar no debe esperar a un observador.
 * Con movimiento reducido, o sin IntersectionObserver, el elemento ya entra visible. Es un ref de función para que
 * una sección que aparece después (la descripción que llega con el producto) también se observe; el atributo va al
 * DOM y no al estado de React: es solo presentación y no vuelve a renderizar nada.
 */
export function useRevelarAlEntrar<E extends HTMLElement>(): RefCallback<E> {
  const reducido = useMovimientoReducido();
  return useCallback(
    (elemento: E | null) => {
      if (!elemento || elemento.hasAttribute(ATRIBUTO)) return;
      if (reducido || typeof IntersectionObserver === 'undefined') {
        elemento.setAttribute(ATRIBUTO, '');
        return;
      }
      const observador = new IntersectionObserver(
        (entradas) => {
          if (!entradas.some((entrada) => entrada.isIntersecting)) return;
          elemento.setAttribute(ATRIBUTO, '');
          observador.disconnect();
        },
        { threshold: UMBRAL_VISIBLE },
      );
      observador.observe(elemento);
      return () => {
        observador.disconnect();
      };
    },
    [reducido],
  );
}
