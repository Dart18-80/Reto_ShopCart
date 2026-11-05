import type { Pagar } from '@shopcart/shared';
import { useRef, useState } from 'react';
import { nuevaLlaveDeIdempotencia } from '../llaveIdempotencia';

interface Intento {
  llave: string;
  tarjeta: Pagar;
}

export interface IntentoDePago {
  /** La llave para enviar `tarjeta`: la del intento en curso o, si no hay, la de uno nuevo. */
  llavePara: (tarjeta: Pagar) => string;
  /** La misma solicitud del intento en curso, para «Reintentar»; `null` si no hay intento. */
  pendiente: () => Pagar | null;
  /** El intento terminó (pagado, rechazado o la sesión se perdió): el próximo lleva una llave nueva. */
  terminar: () => void;
}

/**
 * RF-06: una llave por intento. El intento vive solo en memoria (un ref): nunca en el estado que se dibuja, en el
 * almacenamiento del navegador ni en un log, y se descarta al terminar o al salir de la página. Guarda la tarjeta
 * para que «Reintentar» reenvíe exactamente la misma solicitud: el backend compara sesión, monto, marca y últimos
 * 4 dígitos, y otra tarjeta con la misma llave sería un 422 (decisión del PO en M4-H03).
 */
export function useIntentoDePago(): IntentoDePago {
  const intento = useRef<Intento | null>(null);
  // Se crean una sola vez: la página puede pasarlas a usePagar sin que cambien en cada render.
  const [operaciones] = useState<IntentoDePago>(() => ({
    llavePara: (tarjeta) => {
      intento.current ??= { llave: nuevaLlaveDeIdempotencia(), tarjeta };
      return intento.current.llave;
    },
    pendiente: () => intento.current?.tarjeta ?? null,
    terminar: () => {
      intento.current = null;
    },
  }));
  return operaciones;
}
