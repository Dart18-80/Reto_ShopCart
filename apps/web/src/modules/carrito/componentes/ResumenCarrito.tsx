import type { ReactNode } from 'react';
import { Monto } from '../../../shared/componentes/Monto';
import type { Carrito } from '../carrito.api';

/** Figma: Fila de resumen. */
function FilaResumen({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="texto-base text-muted-foreground">{etiqueta}</dt>
      <dd className="texto-base text-right">{children}</dd>
    </div>
  );
}

interface PropsResumen {
  resumen: Carrito['resumen'];
  /** Lo que va entre el título y los montos (el cupón, M3-H03) y al final (continuar, M3-H04). */
  antes?: ReactNode;
  despues?: ReactNode;
}

/** Figma 38:776: los montos tal como los calcula el backend (N-12, FE-10); aquí no se suma nada. */
export function ResumenCarrito({ resumen, antes, despues }: PropsResumen) {
  return (
    <section
      aria-labelledby="titulo-resumen"
      className="bg-card flex flex-col gap-4 rounded-lg border p-6"
    >
      <h2 id="titulo-resumen" className="display-titulo-3">
        Resumen
      </h2>
      {antes}
      <dl className="flex flex-col gap-3 border-t pt-4">
        <FilaResumen etiqueta="Subtotal">
          <Monto valor={resumen.subtotal} />
        </FilaResumen>
        <FilaResumen etiqueta="Envío">Se elige en el siguiente paso</FilaResumen>
      </dl>
      <dl className="border-t pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="texto-base-fuerte">Total</dt>
          <dd>
            <Monto valor={resumen.total} className="display-precio" />
          </dd>
        </div>
      </dl>
      {despues}
      <p className="texto-nota text-muted-foreground">
        Incluye IVA del 12 %. El envío y el total final se confirman en el pago.
      </p>
    </section>
  );
}
