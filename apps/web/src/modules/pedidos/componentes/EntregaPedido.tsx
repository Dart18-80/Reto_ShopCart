import { formatearFechaCalendario } from '../../../shared/formato/fecha';
import type { Pedido } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

/** Figma 47:1222: a dónde y cuándo llega, con las copias que el pedido congeló al pagarse (M-04). */
export function EntregaPedido({ pedido: { direccion, envio } }: { pedido: Pedido }) {
  return (
    <SeccionPedido titulo="Entrega">
      <div className="texto-pequeno text-muted-foreground flex flex-col gap-1">
        <p>{`${direccion.nombreRecibe}, ${direccion.telefonoRecibe}`}</p>
        <p>{direccion.direccionLinea}</p>
        {direccion.referencia && <p>{direccion.referencia}</p>}
        <p>{`${direccion.municipio}, ${direccion.departamento}`}</p>
        <p>{`Envío ${envio.nombre}: fecha estimada ${formatearFechaCalendario(envio.fechaEstimadaEntrega)}.`}</p>
      </div>
    </SeccionPedido>
  );
}
