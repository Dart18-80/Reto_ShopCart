import { useSyncExternalStore } from 'react';

// El punto `md` de Tailwind: desde aquí, tabla; por debajo, tarjetas (FE-06).
const CONSULTA_ANCHA = '(min-width: 48rem)';

function suscribir(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_ANCHA);
  consulta.addEventListener('change', avisar);
  return () => {
    consulta.removeEventListener('change', avisar);
  };
}

const esAncha = () => window.matchMedia(CONSULTA_ANCHA).matches;

/** Si la pantalla llega al punto `md`. Se decide en JS para montar solo una vista, no las dos ocultando una. */
export function usePantallaAncha(): boolean {
  return useSyncExternalStore(suscribir, esAncha);
}
