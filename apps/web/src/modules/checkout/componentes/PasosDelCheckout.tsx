import { cn } from '../../../shared/ui/cn';

const PASOS = ['Dirección y envío', 'Pago'] as const;

/** Figma: Pasos del checkout (36:284). Cada paso es una ruta (05 §6); `actual` es el número del paso. */
export function PasosDelCheckout({ actual }: { actual: 1 | 2 }) {
  return (
    <ol aria-label="Pasos del pago" className="flex items-center gap-3">
      {PASOS.map((paso, indice) => {
        const numero = indice + 1;
        const esActual = numero === actual;
        return (
          <li
            key={paso}
            aria-current={esActual ? 'step' : undefined}
            className="flex items-center gap-3"
          >
            {indice > 0 && <span aria-hidden className="bg-border h-0.5 w-12" />}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'texto-pequeno-fuerte flex size-7 items-center justify-center rounded-full',
                  esActual
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {numero}
              </span>
              <span
                className={cn(
                  'texto-pequeno-fuerte',
                  esActual ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {paso}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
