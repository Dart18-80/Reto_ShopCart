import { useId, type ReactNode } from 'react';
import { RadioGroupItem } from '../../../shared/ui/radio-group';

interface PropsOpcion {
  valor: string;
  titulo: string;
  detalle: string;
  /** Lo que va a la derecha (el costo del envío); la dirección no lleva. */
  extra?: ReactNode;
}

/**
 * Figma: Opción (36:263), una tarjeta seleccionable dentro de un RadioGroup: la etiqueta es toda la tarjeta y
 * la elegida se marca con el borde y el fondo.
 */
export function Opcion({ valor, titulo, detalle, extra }: PropsOpcion) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="bg-card has-data-[state=checked]:border-ring has-data-[state=checked]:bg-secondary flex cursor-pointer items-start gap-3 rounded-control border p-4 has-data-[state=checked]:border-2 has-data-[state=checked]:p-[calc(--spacing(4)-1px)]"
    >
      <RadioGroupItem id={id} value={valor} className="mt-1" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="texto-base-fuerte">{titulo}</span>
        <span className="texto-pequeno text-muted-foreground">{detalle}</span>
      </span>
      {extra && <span className="texto-base-fuerte">{extra}</span>}
    </label>
  );
}
