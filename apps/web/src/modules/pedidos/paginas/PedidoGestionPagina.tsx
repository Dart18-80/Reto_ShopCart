import { idEnRutaSchema } from '@shopcart/shared';
import { SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { AvisoDePagina } from '../../../shared/componentes/AvisoDePagina';
import { EstadoPedido } from '../../../shared/componentes/EstadoPedido';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { ArticulosPedido } from '../componentes/ArticulosPedido';
import { ClientePedido } from '../componentes/ClientePedido';
import { EntregaPedido } from '../componentes/EntregaPedido';
import { HistorialGestion } from '../componentes/HistorialGestion';
import { PagoPedido } from '../componentes/PagoPedido';
import { usePedidoGestion } from '../hooks/usePedidosGestion';
import type { PedidoGestion } from '../pedidos.api';

const STATUS_NO_ENCONTRADO = 404;
const RUTA_LISTA = '/backoffice/pedidos';
// El pedido existe si la consulta respondió: nunca es «vacío».
const NUNCA_VACIO = () => false;
const SIN_USO = { titulo: '' };

function PedidoNoEncontrado() {
  return (
    <AvisoDePagina
      icono={SearchX}
      titulo="No encontramos este pedido"
      acciones={
        <Button asChild>
          <Link to={RUTA_LISTA}>Ver los pedidos</Link>
        </Button>
      }
    >
      Puede que el enlace esté mal escrito.
    </AvisoDePagina>
  );
}

function FichaPedidoGestion({ pedido }: { pedido: PedidoGestion }) {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="texto-pequeno text-muted-foreground">
        <Link to={RUTA_LISTA} className="hover:underline">
          Pedidos
        </Link>
        {` / Pedido ${pedido.numeroPedido}`}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display-titulo-1">{`Pedido ${pedido.numeroPedido}`}</h1>
        <EstadoPedido estado={pedido.estado} />
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[1fr_19rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ArticulosPedido pedido={pedido} />
          <HistorialGestion historial={pedido.historial} />
        </div>
        <div className="flex flex-col gap-6">
          <ClientePedido cliente={pedido.cliente} />
          <EntregaPedido pedido={pedido} />
          <PagoPedido pedido={pedido} />
        </div>
      </div>
    </div>
  );
}

function DetallePedidoGestion({ idPedido }: { idPedido: number }) {
  const consulta = usePedidoGestion(idPedido);
  useTituloPagina(consulta.data ? `Pedido ${consulta.data.numeroPedido}` : 'Pedido');

  if (consulta.isLoadingError && consulta.error.status === STATUS_NO_ENCONTRADO) {
    return <PedidoNoEncontrado />;
  }
  return (
    <EstadoVista consulta={consulta} vacio={SIN_USO} esVacio={NUNCA_VACIO}>
      {(pedido) => <FichaPedidoGestion pedido={pedido} />}
    </EstadoVista>
  );
}

/**
 * M8-H02 (Figma 47:1222 con los bloques del detalle del Cliente): `/backoffice/pedidos/:id`, más el cliente y el
 * historial con rol y motivo. Operador y Administrador.
 */
export function PedidoGestionPagina() {
  const id = idEnRutaSchema.safeParse(useParams().id);
  return id.success ? <DetallePedidoGestion idPedido={id.data} /> : <PedidoNoEncontrado />;
}
