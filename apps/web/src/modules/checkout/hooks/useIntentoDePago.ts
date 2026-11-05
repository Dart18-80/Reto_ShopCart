import type { Pagar } from '@shopcart/shared';
import { useRef, useState } from 'react';
import { nuevaLlaveDeIdempotencia } from '../llaveIdempotencia';

export interface Intento {
  llave: string;
  tarjeta: Pagar;
}

export interface IntentoDePago {
  /** Empieza un intento con `tarjeta` y una llave nueva, salvo que ya haya uno en curso (que se conserva). */
  preparar: (tarjeta: Pagar) => void;
  /** El intento en curso (su llave y su solicitud), o `null` si no hay. */
  actual: () => Intento | null;
  /** El intento terminó (pagado, rechazado o la sesión se perdió): el próximo lleva una llave nueva. */
  terminar: () => void;
}

/**
 * RF-06: una llave por intento. El intento vive solo en memoria (un ref): nunca en el estado que se dibuja, en la
 * caché de TanStack Query, en el almacenamiento del navegador ni en un log, y se descarta al terminar o al salir de
 * la página. Guarda la tarjeta para que «Reintentar» reenvíe exactamente la misma solicitud: el backend compara
 * sesión, monto, marca y últimos 4 dígitos, y otra tarjeta con la misma llave sería un 422 (decisión del PO en
 * M4-H03).
 */
export function useIntentoDePago(): IntentoDePago {
  const intento = useRef<Intento | null>(null);
  // Se crean una sola vez: la página puede pasarlas a usePagar sin que cambien en cada render.
  const [operaciones] = useState<IntentoDePago>(() => ({
    preparar: (tarjeta) => {
      intento.current ??= { llave: nuevaLlaveDeIdempotencia(), tarjeta };
    },
    actual: () => intento.current,
    terminar: () => {
      intento.current = null;
    },
  }));
  return operaciones;
}
