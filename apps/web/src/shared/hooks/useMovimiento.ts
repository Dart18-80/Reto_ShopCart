import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

// D2: el movimiento que se hace con la Web Animations API (sin volver a montar nada). Las duraciones y curvas son
// las de movimiento.css; con `prefers-reduced-motion: reduce` solo queda un fundido de 100 ms o menos.

const CONSULTA_REDUCIDO = '(prefers-reduced-motion: reduce)';
const CURVA_SALIDA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const CURVA = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DURACION_BASE_MS = 200;
const DURACION_REBOTE_MS = 300;
const DURACION_REDUCIDA_MS = 100;

export interface Animacion {
  fotogramas: Keyframe[];
  opciones: KeyframeAnimationOptions;
}

function suscribir(avisar: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const consulta = window.matchMedia(CONSULTA_REDUCIDO);
  consulta.addEventListener('change', avisar);
  return () => {
    consulta.removeEventListener('change', avisar);
  };
}

const prefiereReducido = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_REDUCIDO).matches;

/** Si la persona pidió menos movimiento en su sistema. */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, prefiereReducido);
}

/**
 * La entrada de una página: sube 8 px con fundido en 200 ms; con movimiento reducido, solo el fundido. Desplaza con
 * `top` sobre el <main> en posición relativa y no con `transform`: un transform haría del <main> el bloque contenedor
 * de las barras fijas de móvil (CLASE_BARRA_FIJA) mientras dura la animación, y saltarían al terminar.
 */
export function animacionDeEntrada(reducido: boolean): Animacion {
  if (reducido) {
    return {
      fotogramas: [{ opacity: 0 }, { opacity: 1 }],
      opciones: { duration: DURACION_REDUCIDA_MS, easing: 'linear' },
    };
  }
  return {
    fotogramas: [
      { opacity: 0, top: '8px' },
      { opacity: 1, top: '0px' },
    ],
    opciones: { duration: DURACION_BASE_MS, easing: CURVA_SALIDA },
  };
}

/** El rebote de la insignia del carrito (1 → 1.25 → 1 en 300 ms). Con movimiento reducido no hay rebote. */
export function animacionDeRebote(reducido: boolean): Animacion | null {
  if (reducido) return null;
  return {
    fotogramas: [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }],
    opciones: { duration: DURACION_REBOTE_MS, easing: CURVA },
  };
}

function animar(elemento: HTMLElement | null, animacion: Animacion | null) {
  // jsdom no implementa animate(): sin él, el elemento queda en su estado final.
  if (!elemento || !animacion || typeof elemento.animate !== 'function') return;
  elemento.animate(animacion.fotogramas, animacion.opciones);
}

/**
 * Anima la entrada del elemento cada vez que cambia `clave` (el pathname): cambiar filtros o la página de una
 * tabla cambia la búsqueda, no el pathname, y no vuelve a animar.
 */
export function useAnimarEntrada<E extends HTMLElement>(clave: string): RefObject<E | null> {
  const ref = useRef<E>(null);
  const claveAnimada = useRef<string | null>(null);
  const reducido = useMovimientoReducido();
  useLayoutEffect(() => {
    // Solo el cambio de clave anima; cambiar la preferencia a media página no repite la entrada.
    if (claveAnimada.current === clave) return;
    claveAnimada.current = clave;
    animar(ref.current, animacionDeEntrada(reducido));
  }, [clave, reducido]);
  return ref;
}

/**
 * Rebota el elemento cuando `valor` sube. `undefined` es «todavía no se sabe» (la consulta no llegó): el primer
 * valor conocido no rebota, así que cargar la página con productos en el carrito no anima nada.
 */
export function useReboteAlSubir<E extends HTMLElement>(
  valor: number | undefined,
): RefObject<E | null> {
  const ref = useRef<E>(null);
  const anterior = useRef(valor);
  const reducido = useMovimientoReducido();
  useLayoutEffect(() => {
    if (valor === undefined) return;
    if (anterior.current !== undefined && valor > anterior.current) {
      animar(ref.current, animacionDeRebote(reducido));
    }
    anterior.current = valor;
  }, [valor, reducido]);
  return ref;
}
