import { nombreDelEstado } from '../../../shared/componentes/EstadoPedido';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import type { PedidoGestion } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

/**
 * M8-H02: el historial completo para el personal (N-08): cada cambio con su fecha, el rol de quien lo hizo y su
 * motivo. Es la auditoría del pedido, por eso muestra lo que el seguimiento del Cliente omite.
 */
export function HistorialGestion({ historial }: { historial: PedidoGestion['historial'] }) {
  return (
    <SeccionPedido titulo="Historial">
      <ol className="flex flex-col gap-4">
        {historial.map((cambio) => (
          <li key={`${cambio.estadoNuevo}-${cambio.fecha}`} className="flex gap-3">
            <span aria-hidden className="bg-primary mt-1.5 size-2.5 shrink-0 rounded-full" />
            <div className="flex flex-col">
              <span className="texto-pequeno-fuerte">{nombreDelEstado(cambio.estadoNuevo)}</span>
              <span className="texto-nota text-muted-foreground">
                {`${formatearFechaHora(cambio.fecha)} · ${cambio.rol}`}
              </span>
              {cambio.motivo && <span className="texto-nota">{`Motivo: ${cambio.motivo}`}</span>}
            </div>
          </li>
        ))}
      </ol>
    </SeccionPedido>
  );
}
