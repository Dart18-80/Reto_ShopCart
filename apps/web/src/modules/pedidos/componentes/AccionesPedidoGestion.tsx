import type { CambiarEstadoPedido, CancelarPedido } from '@shopcart/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ErrorApi } from '../../../shared/api';
import { esEstadoPedido } from '../estados';
import type { Cancelacion, Pedido, PedidoGestion } from '../pedidos.api';
import { DialogoCambiarEstado } from './DialogoCambiarEstado';
import { DialogoCancelarPedido } from './DialogoCancelarPedido';

interface PropsAccionesPedidoGestion {
  pedido: PedidoGestion;
  cambiar: UseMutationResult<Pedido, ErrorApi, CambiarEstadoPedido>;
  cancelar: UseMutationResult<Cancelacion, ErrorApi, CancelarPedido>;
}

/**
 * M8-H03: un botón por cada estado de `transicionesPermitidas` y «Cancelar pedido» con `puedeCancelar`: lo que se
 * puede hacer lo decide el backend para el rol de quien mira (N-08, N-09); aquí no hay mapa de transiciones.
 */
export function AccionesPedidoGestion({ pedido, cambiar, cancelar }: PropsAccionesPedidoGestion) {
  const { estado } = pedido;
  return (
    <div className="flex flex-wrap gap-2">
      {esEstadoPedido(estado) &&
        pedido.transicionesPermitidas.map((estadoNuevo) => (
          <DialogoCambiarEstado
            key={estadoNuevo}
            estadoActual={estado}
            estadoNuevo={estadoNuevo}
            numeroPedido={pedido.numeroPedido}
            mutacion={cambiar}
          />
        ))}
      <DialogoCancelarPedido
        puedeCancelar={pedido.puedeCancelar}
        mutacion={cancelar}
        descripcion="Los productos vuelven al inventario y el cobro se reembolsa a la tarjeta del cliente."
      />
    </div>
  );
}
