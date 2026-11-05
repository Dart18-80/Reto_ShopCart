import { montoMenorOIgual } from '@shopcart/shared';
import { FilaResumen, FilaTotal } from '../../../shared/componentes/FilaResumen';
import { Monto } from '../../../shared/componentes/Monto';
import { formatearConteo } from '../../../shared/formato/conteo';
import { formatearMonto } from '../../../shared/formato/monto';
import type { Pedido } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

const SIN_COSTO = '0.00';

/**
 * Figma 47:1222: los artículos con su variante y SKU, y los montos tal como los congeló el backend (FE-10, N-18):
 * aquí no se suma ni se calcula el IVA.
 */
export function ArticulosPedido({ pedido }: { pedido: Pedido }) {
  return (
    <SeccionPedido titulo="Artículos">
      <ul className="flex flex-col gap-3.5">
        {pedido.lineas.map((linea) => (
          <li key={linea.idDetallePedido} className="flex items-start justify-between gap-4">
            <span className="flex min-w-0 flex-col">
              <span className="texto-pequeno-fuerte">{`${linea.producto} × ${String(linea.cantidad)}`}</span>
              <span className="texto-nota text-muted-foreground">{`${linea.descripcionVariante}, SKU ${linea.sku}`}</span>
              {linea.cantidadDevuelta > 0 && (
                <span className="texto-nota text-oferta">
                  {formatearConteo(linea.cantidadDevuelta, 'unidad devuelta', 'unidades devueltas')}
                </span>
              )}
            </span>
            <Monto valor={linea.totalLinea} className="texto-pequeno-fuerte" />
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-3.5 border-t pt-3.5">
        <FilaResumen etiqueta="Subtotal">
          <Monto valor={pedido.subtotal} />
        </FilaResumen>
        {pedido.codigoCupon && (
          <FilaResumen etiqueta={`Descuento (${pedido.codigoCupon})`}>
            <span className="text-exito">
              −<Monto valor={pedido.descuento} />
            </span>
          </FilaResumen>
        )}
        <FilaResumen etiqueta={`Envío ${pedido.envio.nombre}`}>
          {montoMenorOIgual(pedido.costoEnvio, SIN_COSTO) ? (
            'Gratis'
          ) : (
            <Monto valor={pedido.costoEnvio} />
          )}
        </FilaResumen>
      </dl>
      <dl className="flex flex-col gap-3.5 border-t pt-3.5">
        <FilaTotal>
          <Monto valor={pedido.total} className="display-precio" />
        </FilaTotal>
        {!montoMenorOIgual(pedido.montoReembolsado, SIN_COSTO) && (
          <FilaResumen etiqueta="Reembolsado">
            <Monto valor={pedido.montoReembolsado} />
          </FilaResumen>
        )}
      </dl>
      <p className="texto-nota text-muted-foreground">
        {`Incluye IVA del 12 %: base imponible ${formatearMonto(pedido.baseImponible)} e IVA ${formatearMonto(pedido.iva)}.`}
      </p>
    </SeccionPedido>
  );
}
