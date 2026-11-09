import type { ReactNode } from 'react';
import { FilaResumen, FilaTotal } from '../../../shared/componentes/FilaResumen';
import { Monto } from '../../../shared/componentes/Monto';

export interface LineaResumen {
  clave: number;
  producto: string;
  descripcionAtributos: string;
  cantidad: number;
  totalLinea: string;
}

interface PropsResumenPedido {
  lineas: LineaResumen[];
  subtotal: string;
  descuento: string;
  codigoCupon: string | null;
  envio: ReactNode;
  total: string;
  /** Lo que va bajo el título: en el pago, a dónde y cómo llega (M4-H03). */
  encabezado?: ReactNode;
  /** El aviso y la acción del paso, debajo del total. */
  children: ReactNode;
}

/**
 * Figma 40:933, «Tu pedido»: las líneas y los montos tal como los calcula el backend (FE-10). En el paso 1 salen
 * del carrito y del método elegido; en el pago, de la sesión congelada (M4-H03).
 */
export function ResumenPedido({
  lineas,
  subtotal,
  descuento,
  codigoCupon,
  envio,
  total,
  encabezado,
  children,
}: PropsResumenPedido) {
  return (
    <section
      aria-labelledby="titulo-tu-pedido"
      className="bg-card flex flex-col gap-3.5 rounded-tarjeta border p-4 shadow-xs md:p-5"
    >
      <h2 id="titulo-tu-pedido" className="titulo-2">
        Tu pedido
      </h2>
      {encabezado}
      <ul aria-label="Productos del pedido" className="flex flex-col gap-3.5">
        {lineas.map((linea) => (
          <li key={linea.clave} className="flex items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col">
              <span className="texto-pequeno-fuerte">{`${linea.producto} × ${String(linea.cantidad)}`}</span>
              <span className="texto-nota text-muted-foreground">{linea.descripcionAtributos}</span>
            </span>
            <Monto valor={linea.totalLinea} className="texto-pequeno-fuerte" />
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-3.5 border-t pt-3.5">
        <FilaResumen etiqueta="Subtotal">
          <Monto valor={subtotal} />
        </FilaResumen>
        {codigoCupon && (
          <FilaResumen etiqueta={`Descuento (${codigoCupon})`}>
            <span className="text-exito">
              −<Monto valor={descuento} />
            </span>
          </FilaResumen>
        )}
        <FilaResumen etiqueta="Envío">{envio}</FilaResumen>
      </dl>
      <dl className="border-t pt-3.5">
        <FilaTotal>
          <Monto valor={total} className="display-precio" />
        </FilaTotal>
      </dl>
      {children}
    </section>
  );
}
