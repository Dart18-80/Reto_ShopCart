import type { PedidoGestion } from '../pedidos.api';
import { SeccionPedido } from './SeccionPedido';

/** M8-H02: quién compró (para el personal); el Cliente nunca ve este bloque. */
export function ClientePedido({ cliente }: { cliente: PedidoGestion['cliente'] }) {
  return (
    <SeccionPedido titulo="Cliente">
      <div className="texto-pequeno flex flex-col gap-1">
        <p className="texto-pequeno-fuerte">{cliente.nombre}</p>
        <a href={`mailto:${cliente.correo}`} className="text-primary break-all hover:underline">
          {cliente.correo}
        </a>
      </div>
    </SeccionPedido>
  );
}
