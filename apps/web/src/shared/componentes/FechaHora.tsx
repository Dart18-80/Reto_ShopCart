import { formatearFechaHora } from '../formato/fecha';

/** Un instante del backend en la hora de Guatemala; `dateTime` conserva el instante original (FE-10). */
export function FechaHora({ valor }: { valor: string }) {
  return <time dateTime={valor}>{formatearFechaHora(valor)}</time>;
}
