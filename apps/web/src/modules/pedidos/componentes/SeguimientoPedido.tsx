import {
  Circle,
  CircleX,
  CreditCard,
  PackageCheck,
  PackageOpen,
  Truck,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../shared/ui/cn';
import { nombreDelEstado } from '../../../shared/componentes/EstadoPedido';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import type { Pedido } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

// D5: el ícono de cada estado (EstadoPedido de la semilla S001); uno desconocido lleva un círculo.
const ICONO_DEL_ESTADO: Record<string, LucideIcon> = {
  Pagado: CreditCard,
  EnPreparacion: PackageOpen,
  Despachado: Truck,
  Entregado: PackageCheck,
  Cancelado: CircleX,
  DevueltoParcial: Undo2,
  Devuelto: Undo2,
};

/**
 * Figma 47:1222: el seguimiento con solo los cambios que registró el historial (N-08). Los pasos futuros del frame
 * no se dibujan: dependerían del mapa de transiciones, que es del backend.
 */
export function SeguimientoPedido({ historial }: { historial: Pedido['historial'] }) {
  return (
    <SeccionPedido titulo="Seguimiento">
      {/* D5: una línea de tiempo vertical, con un ícono por estado y el conector hasta el siguiente cambio. */}
      <ol className="flex flex-col">
        {historial.map((cambio, indice) => {
          const Icono = ICONO_DEL_ESTADO[cambio.estadoNuevo] ?? Circle;
          const esElActual = indice === historial.length - 1;
          return (
            <li
              key={`${cambio.estadoNuevo}-${cambio.fecha}`}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {!esElActual && (
                <span
                  aria-hidden
                  className="bg-border absolute top-9 bottom-1 left-4 w-0.5 -translate-x-1/2"
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  esElActual
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground',
                )}
              >
                <Icono className="size-4" />
              </span>
              <div className="flex flex-col pt-1">
                <span className="texto-pequeno-fuerte">{nombreDelEstado(cambio.estadoNuevo)}</span>
                <span className="texto-nota text-muted-foreground">
                  {formatearFechaHora(cambio.fecha)}
                </span>
                {cambio.motivo && (
                  <span className="texto-nota text-muted-foreground">{cambio.motivo}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </SeccionPedido>
  );
}
