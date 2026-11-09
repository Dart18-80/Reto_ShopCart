import { idEnRutaSchema } from '@shopcart/shared';
import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoDePagina } from '../../../shared/componentes/AvisoDePagina';
import { EstadoPedido } from '../../../shared/componentes/EstadoPedido';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { AccionesPedidoGestion } from '../componentes/AccionesPedidoGestion';
import { ArticulosPedido } from '../componentes/ArticulosPedido';
import { AvisoReembolsoGestion } from '../componentes/AvisoReembolsoGestion';
import { ClientePedido } from '../componentes/ClientePedido';
import { EntregaPedido } from '../componentes/EntregaPedido';
import { HistorialGestion } from '../componentes/HistorialGestion';
import { PagoPedido } from '../componentes/PagoPedido';
import {
  useCambiarEstadoPedido,
  useCancelarPedidoGestion,
  useRegistrarDevolucion,
} from '../hooks/useAccionesGestion';
import { usePedidoGestion } from '../hooks/usePedidosGestion';
import type { PedidoGestion } from '../pedidos.api';
import { RUTAS } from '../../../shared/rutas';

const STATUS_NO_ENCONTRADO = 404;
const CONFLICTO = 'CONFLICTO_CONCURRENCIA';
const NO_CANCELABLE = 'NO_CANCELABLE';
const RUTA_LISTA = RUTAS.gestionPedidos;
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

/** Un aviso de lo que pasó al actuar; «Entendido» lo descarta (olvida el resultado de esa mutación). */
function AvisoDescartable({
  tipo,
  alDescartar,
  children,
}: {
  tipo: 'advertencia' | 'error';
  alDescartar: () => void;
  children: ReactNode;
}) {
  return (
    <Aviso
      tipo={tipo}
      acciones={
        <Button variant="outline" size="sm" onClick={alDescartar}>
          Entendido
        </Button>
      }
    >
      {children}
    </Aviso>
  );
}

function AvisosDeAcciones({
  cambiar,
  cancelar,
  devolver,
}: {
  cambiar: ReturnType<typeof useCambiarEstadoPedido>;
  cancelar: ReturnType<typeof useCancelarPedidoGestion>;
  devolver: ReturnType<typeof useRegistrarDevolucion>;
}) {
  return (
    <>
      {/* El diálogo que falló ya se cerró (cambió el estado): el aviso queda hasta que se descarte o se actúe. */}
      {cambiar.error?.codigo === CONFLICTO && (
        <AvisoDescartable tipo="advertencia" alDescartar={cambiar.reset}>
          El pedido cambió mientras lo veías. Ya ves su estado actual: revisa antes de seguir.
        </AvisoDescartable>
      )}
      {cancelar.error?.codigo === NO_CANCELABLE && (
        <AvisoDescartable tipo="error" alDescartar={cancelar.reset}>
          {cancelar.error.mensaje}
        </AvisoDescartable>
      )}
      {cancelar.data && (
        <AvisoReembolsoGestion
          hecho="Cancelamos el pedido."
          monto={cancelar.data.pedido.montoReembolsado}
          estado={cancelar.data.reembolso.estado}
        />
      )}
      {devolver.data && (
        <AvisoReembolsoGestion
          hecho="Registramos la devolución."
          monto={devolver.data.devolucion.montoReembolso}
          estado={devolver.data.reembolso.estado}
        />
      )}
    </>
  );
}

function FichaPedidoGestion({ pedido }: { pedido: PedidoGestion }) {
  const cambiar = useCambiarEstadoPedido(pedido.idPedido);
  const cancelar = useCancelarPedidoGestion(pedido.idPedido);
  const devolver = useRegistrarDevolucion(pedido.idPedido);
  return (
    <div className="flex flex-col gap-6">
      <AvisosDeAcciones cambiar={cambiar} cancelar={cancelar} devolver={devolver} />
      <nav aria-label="Ruta" className="texto-pequeno text-muted-foreground">
        <Link to={RUTA_LISTA} className="hover:underline">
          Pedidos
        </Link>
        {` / Pedido ${pedido.numeroPedido}`}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display-titulo-1">{`Pedido ${pedido.numeroPedido}`}</h1>
          <EstadoPedido estado={pedido.estado} />
        </div>
        {/* Con otro estado cambian las acciones: los diálogos del estado anterior se cierran solos. */}
        <AccionesPedidoGestion
          key={pedido.estado}
          pedido={pedido}
          cambiar={cambiar}
          cancelar={cancelar}
          devolver={devolver}
        />
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
