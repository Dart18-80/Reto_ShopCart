import { idEnRutaSchema } from '@shopcart/shared';
import { SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoDePagina } from '../../../shared/componentes/AvisoDePagina';
import { EstadoPedido } from '../../../shared/componentes/EstadoPedido';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { ArticulosPedido } from '../componentes/ArticulosPedido';
import { AvisoCancelacion } from '../componentes/AvisoCancelacion';
import { DialogoCancelarPedido } from '../componentes/DialogoCancelarPedido';
import { EntregaPedido } from '../componentes/EntregaPedido';
import { PagoPedido } from '../componentes/PagoPedido';
import { SeguimientoPedido } from '../componentes/SeguimientoPedido';
import type { Pedido } from '../pedidos.api';
import { useCancelarPedido } from '../hooks/useCancelarPedido';
import { usePedido } from '../hooks/usePedido';

const STATUS_NO_ENCONTRADO = 404;
// M4-H03: el pago lleva aquí con ?nuevo=1.
const consultaDetalleSchema = z.object({ nuevo: z.enum(['1']).optional() });
// El pedido existe si la consulta respondió: nunca es «vacío».
const NUNCA_VACIO = () => false;
const SIN_USO = { titulo: '' };

const AGRADECIMIENTO: Record<Pedido['estadoPago'], string> = {
  Confirmado:
    '¡Gracias por tu compra! Tu pago se confirmó y te avisaremos cuando despachemos tu pedido.',
  EnVerificacion:
    '¡Gracias por tu compra! Tu pago está en verificación y te avisaremos cuando se confirme.',
};

function PedidoNoEncontrado() {
  return (
    <AvisoDePagina
      icono={SearchX}
      titulo="No encontramos este pedido"
      acciones={
        <Button asChild>
          <Link to="/pedidos">Ver mis pedidos</Link>
        </Button>
      }
    >
      Puede que el enlace esté mal escrito o que el pedido no sea de tu cuenta.
    </AvisoDePagina>
  );
}

interface PropsFichaPedido {
  pedido: Pedido;
  nuevo: boolean;
  cancelar: ReturnType<typeof useCancelarPedido>;
}

function FichaPedido({ pedido, nuevo, cancelar }: PropsFichaPedido) {
  return (
    <div className="flex flex-col gap-6">
      {nuevo && !cancelar.data && <Aviso tipo="exito">{AGRADECIMIENTO[pedido.estadoPago]}</Aviso>}
      {cancelar.data && <AvisoCancelacion cancelacion={cancelar.data} />}
      <nav aria-label="Ruta" className="texto-pequeno text-muted-foreground">
        <Link to="/pedidos" className="hover:underline">
          Mis pedidos
        </Link>
        {` / Pedido ${pedido.numeroPedido}`}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display-titulo-1">{`Pedido ${pedido.numeroPedido}`}</h1>
          <EstadoPedido estado={pedido.estado} />
        </div>
        <DialogoCancelarPedido
          puedeCancelar={pedido.puedeCancelar}
          mutacion={cancelar}
          descripcion="Los productos vuelven a la tienda y el cobro se reembolsa a tu tarjeta."
        />
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[1fr_19rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ArticulosPedido pedido={pedido} />
          <SeguimientoPedido historial={pedido.historial} />
        </div>
        <div className="flex flex-col gap-6">
          <EntregaPedido pedido={pedido} />
          <PagoPedido pedido={pedido} />
        </div>
      </div>
    </div>
  );
}

function DetallePedido({ idPedido }: { idPedido: number }) {
  const consulta = usePedido(idPedido);
  const cancelar = useCancelarPedido(idPedido);
  const parametros = useParametrosUrl(consultaDetalleSchema);
  useTituloPagina(consulta.data ? `Pedido ${consulta.data.numeroPedido}` : 'Pedido');

  // RF-01: uno ajeno responde igual que uno inexistente (404).
  if (consulta.isLoadingError && consulta.error.status === STATUS_NO_ENCONTRADO) {
    return <PedidoNoEncontrado />;
  }
  return (
    <EstadoVista consulta={consulta} vacio={SIN_USO} esVacio={NUNCA_VACIO}>
      {(pedido) => (
        <FichaPedido pedido={pedido} nuevo={parametros.valores.nuevo === '1'} cancelar={cancelar} />
      )}
    </EstadoVista>
  );
}

/** M5-H01 (Figma 47:1222): `/pedidos/:id`. Un id que no es un número es un pedido que no existe. */
export function PedidoPagina() {
  const id = idEnRutaSchema.safeParse(useParams().id);
  return id.success ? <DetallePedido idPedido={id.data} /> : <PedidoNoEncontrado />;
}
