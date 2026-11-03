import { useEffect } from 'react';

const NOMBRE_TIENDA = 'ShopCart';

/** Cada página pone su título en la pestaña del navegador. */
export function useTituloPagina(titulo: string) {
  useEffect(() => {
    document.title = `${titulo} · ${NOMBRE_TIENDA}`;
  }, [titulo]);
}
