import { formatearConteo } from '../../shared/formato/conteo';

/** El plazo de un método de envío: «3 a 5 días hábiles», «1 día hábil». */
export function diasDeEntrega(diasMin: number, diasMax: number): string {
  if (diasMin === diasMax) return formatearConteo(diasMin, 'día hábil', 'días hábiles');
  return `${String(diasMin)} a ${String(diasMax)} días hábiles`;
}
