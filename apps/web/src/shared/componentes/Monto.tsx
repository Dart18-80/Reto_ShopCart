import { formatearMonto } from '../formato/monto';
import { cn } from '../ui/cn';

/** Un monto del backend tal como llega (texto), formateado en quetzales (FE-10). Nunca se calcula aquí. */
export function Monto({ valor, className }: { valor: string; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatearMonto(valor)}</span>;
}
