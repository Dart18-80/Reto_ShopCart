import { cn } from '../../ui/cn';
import { clasesDelColor } from './colores';

interface PropsMuestraColor {
  color: string;
  seleccionada?: boolean;
  className?: string;
}

/**
 * Figma: Muestra de color (6:24). Solo el dibujo: un aro con el color de la variable --prenda-* y, si está
 * seleccionada, el aro del color primario. Quien la usa decide si es un control (el detalle) o solo visual (la
 * tarjeta) y le da su nombre accesible.
 */
export function MuestraColor({ color, seleccionada = false, className }: PropsMuestraColor) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border-2',
        seleccionada ? 'border-primary' : 'border-border',
        className,
      )}
    >
      <span className={cn('size-3/4 rounded-full', clasesDelColor(color).fondo)} />
    </span>
  );
}
