import { useSyncExternalStore } from 'react';

function suscribir(avisar: () => void) {
  window.addEventListener('scroll', avisar, { passive: true });
  return () => {
    window.removeEventListener('scroll', avisar);
  };
}

const estaDesplazada = () => window.scrollY > 0;

/** D4: si la página ya se desplazó hacia abajo (el encabezado fijo muestra su sombra solo entonces). */
export function useDesplazado(): boolean {
  return useSyncExternalStore(suscribir, estaDesplazada);
}
