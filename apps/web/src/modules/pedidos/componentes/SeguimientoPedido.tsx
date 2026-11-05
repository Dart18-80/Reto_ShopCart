import { nombreDelEstado } from '../../../shared/componentes/EstadoPedido';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import type { Pedido } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

/**
 * Figma 47:1222: el seguimiento con solo los cambios que registró el historial (N-08). Los pasos futuros del frame
 * no se dibujan: dependerían del mapa de transiciones, que es del backend.
 */
export function SeguimientoPedido({ historial }: { historial: Pedido['historial'] }) {
  return (
    <SeccionPedido titulo="Seguimiento">
      <ol className="flex flex-col gap-4">
        {historial.map((cambio) => (
          <li key={`${cambio.estadoNuevo}-${cambio.fecha}`} className="flex gap-3">
            <span aria-hidden className="bg-primary mt-1.5 size-2.5 shrink-0 rounded-full" />
            <div className="flex flex-col">
              <span className="texto-pequeno-fuerte">{nombreDelEstado(cambio.estadoNuevo)}</span>
              <span className="texto-nota text-muted-foreground">
                {formatearFechaHora(cambio.fecha)}
              </span>
              {cambio.motivo && (
                <span className="texto-nota text-muted-foreground">{cambio.motivo}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SeccionPedido>
  );
}
