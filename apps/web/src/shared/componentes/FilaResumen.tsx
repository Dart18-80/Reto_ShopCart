import type { ReactNode } from 'react';

/**
 * Figma: Fila de resumen (36:294), dentro de un `<dl>`. Los montos llegan calculados del backend (resumen del
 * carrito o sesión de pago): aquí no se suma nada (FE-10).
 */
export function FilaResumen({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="texto-base text-muted-foreground">{etiqueta}</dt>
      <dd className="texto-base text-right">{children}</dd>
    </div>
  );
}

/** La fila Total de la Fila de resumen. */
export function FilaTotal({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="texto-base-fuerte">Total</dt>
      <dd>{children}</dd>
    </div>
  );
}
