import type { ReactNode } from 'react';
import { FilaResumen, FilaTotal } from '../../../shared/componentes/FilaResumen';
import { Monto } from '../../../shared/componentes/Monto';
import type { Carrito } from '../carrito.api';
import { EnvioGratis } from './EnvioGratis';

interface PropsResumen {
  resumen: Carrito['resumen'];
  /** Lo que va entre el título y los montos (el cupón) y al final (continuar, M3-H04). */
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
        {resumen.cupon && (
          <FilaResumen etiqueta={`Descuento (${resumen.cupon.codigo})`}>
            <span className="text-exito">
              −<Monto valor={resumen.descuento} />
            </span>
          </FilaResumen>
        )}
        <FilaResumen etiqueta="Envío">Se elige en el siguiente paso</FilaResumen>
      </dl>
      <EnvioGratis envioGratis={resumen.envioGratis} />
      <dl className="border-t pt-4">
        <FilaTotal>
          <Monto valor={resumen.total} className="display-precio" />
        </FilaTotal>
      </dl>
      {despues}
      <p className="texto-nota text-muted-foreground">
        Incluye IVA del 12 %. El envío y el total final se confirman en el pago.
      </p>
    </section>
  );
}
