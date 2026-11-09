import { Link } from 'react-router';
import { EstadoPedido } from '../../../shared/componentes/EstadoPedido';
import { Monto } from '../../../shared/componentes/Monto';
import { formatearConteo } from '../../../shared/formato/conteo';
import { formatearFechaCalendario } from '../../../shared/formato/fecha';
import type { ResumenPedido } from '../pedidos.api';
import { conId, RUTAS } from '../../../shared/rutas';

/** Figma 47:1063: un pedido de la lista. La fecha es el día de pago en Guatemala (A-12), tal como llega. */
export function TarjetaPedido({ pedido }: { pedido: ResumenPedido }) {
  return (
    // D5: toda la tarjeta lleva al detalle con el mismo enlace «Ver detalle» extendido sobre ella (::after): un solo
    // enlace en el DOM, con el mismo nombre y destino. Por eso responde al pasar el cursor.
    <li className="bg-card hover:border-primary/40 relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tarjeta border px-6 py-4 shadow-xs transition-[box-shadow,border-color] duration-(--dur-base) hover:shadow-md">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="texto-base-fuerte">{`Pedido ${pedido.numeroPedido}`}</h2>
          <EstadoPedido estado={pedido.estado} />
        </div>
        <p className="texto-pequeno text-muted-foreground">
          {`${formatearFechaCalendario(pedido.fechaPagoLocal)}, ${formatearConteo(pedido.articulos, 'artículo', 'artículos')}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 md:flex-row md:items-center md:gap-4">
        <Monto valor={pedido.total} className="texto-base-fuerte" />
        <Link
          to={conId(RUTAS.pedido, pedido.idPedido)}
          className="texto-pequeno-fuerte text-primary outline-none after:absolute after:inset-0 after:rounded-tarjeta after:content-[''] hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          Ver detalle<span className="sr-only">{` de ${pedido.numeroPedido}`}</span>
        </Link>
      </div>
    </li>
  );
}
