import { formatearConteo } from '../../shared/formato/conteo';

/** El plazo de un método de envío como lo dice la tienda: «Llega en 3 a 5 días hábiles.». */
export function plazoDeEntrega(diasMin: number, diasMax: number): string {
  if (diasMin === diasMax) {
    return `Llega en ${formatearConteo(diasMin, 'día hábil', 'días hábiles')}.`;
  }
  return `Llega en ${String(diasMin)} a ${String(diasMax)} días hábiles.`;
}
