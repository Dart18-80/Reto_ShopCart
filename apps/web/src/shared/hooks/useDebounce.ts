import { useEffect, useState } from 'react';

/** FE-06: el texto libre espera a que se deje de escribir antes de ir a la URL (y al backend). */
export const ESPERA_TEXTO_LIBRE_MS = 300;

/** El último `valor` que se mantuvo `espera` milisegundos sin cambiar. */
export function useDebounce<T>(valor: T, espera = ESPERA_TEXTO_LIBRE_MS): T {
  const [estable, setEstable] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setEstable(valor);
    }, espera);
    return () => {
      clearTimeout(temporizador);
    };
  }, [valor, espera]);
  return estable;
}
