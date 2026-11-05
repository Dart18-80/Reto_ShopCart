import { formatearFechaHora } from '../../../shared/formato/fecha';
import type { Pedido } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

/** Figma 47:1222: con qué tarjeta y cuándo se pagó (solo marca y últimos 4 dígitos, N-03). */
export function PagoPedido({ pedido }: { pedido: Pedido }) {
  return (
    <SeccionPedido titulo="Pago">
      <div className="texto-pequeno text-muted-foreground flex flex-col gap-1">
        <p>{`${pedido.tarjeta.marca} terminada en ${pedido.tarjeta.ultimosDigitos}`}</p>
        <p>{formatearFechaHora(pedido.fechaPago)}</p>
        {pedido.estadoPago === 'EnVerificacion' && (
          <p className="text-aviso">Tu pago está en verificación.</p>
        )}
      </div>
    </SeccionPedido>
  );
}
