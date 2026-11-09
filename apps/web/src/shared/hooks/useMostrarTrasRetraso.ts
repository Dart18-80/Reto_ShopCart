import { useEffect, useState } from 'react';

/** D3: el esqueleto aparece solo si la carga pasa de 150 ms; una respuesta rápida no hace destellar nada. */
export const RETRASO_ESQUELETO_MS = 150;

/** `false` durante los primeros `retrasoMs` desde que se monta quien lo usa; `true` después. */
export function useMostrarTrasRetraso(retrasoMs: number = RETRASO_ESQUELETO_MS): boolean {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setMostrar(true);
    }, retrasoMs);
    return () => {
      clearTimeout(temporizador);
    };
  }, [retrasoMs]);
  return mostrar;
}
