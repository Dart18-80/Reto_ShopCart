import type { CambiarEstadoPedido, CancelarPedido, RegistrarDevolucion } from '@shopcart/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ErrorApi } from '../../../shared/api';
import { esEstadoPedido } from '../estados';
import type { Cancelacion, DevolucionRegistrada, Pedido, PedidoGestion } from '../pedidos.api';
import { DialogoCambiarEstado } from './DialogoCambiarEstado';
import { DialogoCancelarPedido } from './DialogoCancelarPedido';
import { DialogoDevolucion } from './DialogoDevolucion';

interface PropsAccionesPedidoGestion {
  pedido: PedidoGestion;
  cambiar: UseMutationResult<Pedido, ErrorApi, CambiarEstadoPedido>;
  cancelar: UseMutationResult<Cancelacion, ErrorApi, CancelarPedido>;
  devolver: UseMutationResult<DevolucionRegistrada, ErrorApi, RegistrarDevolucion>;
}

/**
 * M8-H03 y M8-H04: un botón por cada estado de `transicionesPermitidas`, «Registrar devolución» con
 * `puedeDevolver` y «Cancelar pedido» con `puedeCancelar`: lo que se puede hacer lo decide el backend para el rol
 * de quien mira (N-08, N-09, N-10); aquí no hay mapa de transiciones ni plazos.
 */
export function AccionesPedidoGestion({
  pedido,
  cambiar,
  cancelar,
  devolver,
}: PropsAccionesPedidoGestion) {
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
      <DialogoDevolucion pedido={pedido} mutacion={devolver} />
      <DialogoCancelarPedido
        puedeCancelar={pedido.puedeCancelar}
        mutacion={cancelar}
        descripcion="Los productos vuelven al inventario y el cobro se reembolsa a la tarjeta del cliente."
      />
    </div>
  );
}
