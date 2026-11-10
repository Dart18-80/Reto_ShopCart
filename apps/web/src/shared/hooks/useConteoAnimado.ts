import { useLayoutEffect, useRef, type RefObject } from 'react';
import { leerDuracion, useMovimientoReducido } from './useMovimiento';

// Una cifra sola, con su prefijo (Q, -Q) y sus separadores; nada de texto después.
const CIFRA_SOLA = /^[^\d]*\d[\d,.]*$/;
// Los ceros y separadores que sobran a la izquierda de la cifra («Q00,123.45» → «Q123.45»).
const CEROS_A_LA_IZQUIERDA = /^([^\d]*)[0,]+(?=\d)/;
const PASOS_DE_PROGRESO = 10_000n;
const ATRIBUTO_CONTANDO = 'data-contando';

const salidaCubica = (progreso: number) => 1 - (1 - progreso) ** 3;

/**
 * El texto del conteo al `progreso` (0 a 1) del texto real, con su mismo formato. FE-10: un monto no pasa por
 * `number`; se escalan los dígitos del texto ya formateado como un entero exacto (BigInt). `null` si el texto no es
 * una cifra sola (un monto con su etiqueta, un texto sin cifra): ese no se cuenta.
 */
export function textoDelConteo(final: string, progreso: number): string | null {
  if (!CIFRA_SOLA.test(final)) return null;
  const digitos = final.replace(/\D/g, '');
  const parcial =
    (BigInt(digitos) * BigInt(Math.round(progreso * Number(PASOS_DE_PROGRESO)))) /
    PASOS_DE_PROGRESO;
  const relleno = parcial.toString().padStart(digitos.length, '0');
  let siguiente = 0;
  const conFormato = final.replace(/\d/g, () => relleno.charAt(siguiente++));
  return conFormato.replace(CEROS_A_LA_IZQUIERDA, '$1');
}

/**
 * Cuenta de cero a la cifra real al montar, con salida cúbica en --dur-conteo. El texto real se queda siempre en el
 * DOM: mientras dura lleva `data-contando` (quien lo usa lo pasa a sr-only) y el conteo se escribe en el span
 * `conteo`, que es aria-hidden. Sin cuenta con movimiento reducido ni sin animate/requestAnimationFrame (jsdom).
 */
export function useConteoAnimado<E extends HTMLElement>(): {
  real: RefObject<E | null>;
  conteo: RefObject<E | null>;
} {
  const real = useRef<E>(null);
  const conteo = useRef<E>(null);
  const reducido = useMovimientoReducido();
  useLayoutEffect(() => {
    const elementoReal = real.current;
    const elementoConteo = conteo.current;
    if (reducido || !elementoReal || !elementoConteo) return;
    if (typeof elementoReal.animate !== 'function' || typeof requestAnimationFrame !== 'function') {
      return;
    }
    const final = elementoReal.textContent;
    const duracion = leerDuracion('--dur-conteo');
    if (textoDelConteo(final, 0) === null || Number.isNaN(duracion)) return;

    const terminar = () => {
      elementoReal.removeAttribute(ATRIBUTO_CONTANDO);
      elementoConteo.textContent = '';
    };
    const inicio = performance.now();
    let cuadro = 0;
    const avanzar = (ahora: number) => {
      const progreso = Math.min(1, (ahora - inicio) / duracion);
      elementoConteo.textContent = textoDelConteo(final, salidaCubica(progreso));
      if (progreso < 1) {
        cuadro = requestAnimationFrame(avanzar);
        return;
      }
      terminar();
    };
    elementoConteo.textContent = textoDelConteo(final, 0);
    elementoReal.setAttribute(ATRIBUTO_CONTANDO, '');
    cuadro = requestAnimationFrame(avanzar);
    return () => {
      cancelAnimationFrame(cuadro);
      terminar();
    };
  }, [reducido]);
  return { real, conteo };
}
