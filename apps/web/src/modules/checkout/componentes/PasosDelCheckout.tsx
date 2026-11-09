import { cn } from '../../../shared/ui/cn';

const PASOS = ['Dirección y envío', 'Pago'] as const;

/**
 * Figma: Pasos del checkout (36:284 y 36:274). Cada paso es una ruta (05 §6); `actual` es el número del paso. Un
 * paso ya hecho conserva su número en azul y su nombre en gris; el conector hacia el actual también va en azul.
 */
export function PasosDelCheckout({ actual }: { actual: 1 | 2 }) {
  return (
    <ol aria-label="Pasos del pago" className="flex flex-wrap items-center gap-3">
      {PASOS.map((paso, indice) => {
        const numero = indice + 1;
        const esActual = numero === actual;
        const alcanzado = numero <= actual;
        return (
          <li
            key={paso}
            aria-current={esActual ? 'step' : undefined}
            className="flex items-center gap-3"
          >
            {indice > 0 && (
              <span
                aria-hidden
                className="bg-border h-0.5 w-10 overflow-hidden rounded-full md:w-20"
              >
                {alcanzado && <span className="animar-llenado bg-primary block h-full" />}
              </span>
            )}
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  // D5: el paso actual resalta con un anillo; uno hecho conserva su número en azul.
                  'texto-pequeno-fuerte flex size-8 items-center justify-center rounded-full tabular-nums',
                  alcanzado
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                  esActual && 'ring-primary/20 ring-4',
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
