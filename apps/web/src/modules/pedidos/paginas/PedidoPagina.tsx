import { useParams } from 'react-router';
import { PaginaPendiente } from '../../../shared/componentes/PaginaPendiente';

/** `/pedidos/:id`: hasta M5, el marcador del pedido recién pagado; M5 lo convierte en el detalle real. */
export function PedidoPagina() {
  const { id = '' } = useParams();
  return <PaginaPendiente titulo={`Pedido #${id} creado`} />;
}
