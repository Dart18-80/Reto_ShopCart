import { useEffect, useState } from 'react';
import { restanteHasta } from '../cuentaRegresiva';

const INTERVALO_MS = 1000;

/**
 * M4-H03: los milisegundos que faltan para que venza la reserva (`expiraEn` del backend), al segundo. Al llegar
 * a cero deja de contar. El backend es la autoridad: si el reloj del navegador va adelantado, el pago igual
 * responde SESION_VENCIDA.
 */
export function useCuentaRegresiva(expiraEn: string): number {
  const [ahora, setAhora] = useState(() => Date.now());
  const restante = restanteHasta(expiraEn, ahora);
  const vencida = restante === 0;

  useEffect(() => {
    if (vencida) return;
    const intervalo = setInterval(() => {
      setAhora(Date.now());
    }, INTERVALO_MS);
    return () => {
      clearInterval(intervalo);
    };
  }, [vencida]);

  return restante;
}
