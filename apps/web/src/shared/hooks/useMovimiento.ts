import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

// D2: el movimiento que se hace con la Web Animations API (sin volver a montar nada). Las duraciones y curvas no se
// repiten aquí: se leen de las variables de app/movimiento.css, su única fuente. Con `prefers-reduced-motion:
// reduce` solo queda un fundido de --dur-reducida.

const CONSULTA_REDUCIDO = '(prefers-reduced-motion: reduce)';
const MS_POR_SEGUNDO = 1000;

/** Las variables de movimiento.css que usan las animaciones de aquí. */
export interface TokensMovimiento {
  durBase: number;
  durRebote: number;
  durReducida: number;
  curvaSalida: string;
  curva: string;
}

/** «200ms» o «1.4s» en milisegundos; NaN si la variable no está (sin la hoja de estilos). */
function aMilisegundos(valor: string): number {
  const limpio = valor.trim();
  const numero = Number.parseFloat(limpio);
  return limpio.endsWith('ms') ? numero : numero * MS_POR_SEGUNDO;
}

/** Los tokens tal como los define la hoja de estilos en este momento. */
export function leerTokens(raiz: HTMLElement = document.documentElement): TokensMovimiento {
  const estilo = getComputedStyle(raiz);
  const leer = (nombre: string) => estilo.getPropertyValue(nombre);
  return {
    durBase: aMilisegundos(leer('--dur-base')),
    durRebote: aMilisegundos(leer('--dur-rebote')),
    durReducida: aMilisegundos(leer('--dur-reducida')),
    curvaSalida: leer('--curva-salida').trim(),
    curva: leer('--curva').trim(),
  };
}

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
export function animacionDeEntrada(reducido: boolean, tokens: TokensMovimiento): Animacion {
  if (reducido) {
    return {
      fotogramas: [{ opacity: 0 }, { opacity: 1 }],
      opciones: { duration: tokens.durReducida, easing: 'linear' },
    };
  }
  return {
    fotogramas: [
      { opacity: 0, top: '8px' },
      { opacity: 1, top: '0px' },
    ],
    opciones: { duration: tokens.durBase, easing: tokens.curvaSalida },
  };
}

/** El rebote de la insignia del carrito (1 → 1.25 → 1 en 300 ms). Con movimiento reducido no hay rebote. */
export function animacionDeRebote(reducido: boolean, tokens: TokensMovimiento): Animacion | null {
  if (reducido) return null;
  return {
    fotogramas: [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }],
    opciones: { duration: tokens.durRebote, easing: tokens.curva },
  };
}

function animar(elemento: HTMLElement | null, animacion: Animacion | null) {
  // jsdom no implementa animate(), y sin la hoja de estilos no hay duración: el elemento queda en su estado final.
  if (!elemento || !animacion || typeof elemento.animate !== 'function') return;
  if (Number.isNaN(Number(animacion.opciones.duration))) return;
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
    animar(ref.current, animacionDeEntrada(reducido, leerTokens()));
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
      animar(ref.current, animacionDeRebote(reducido, leerTokens()));
    }
    anterior.current = valor;
  }, [valor, reducido]);
  return ref;
}
