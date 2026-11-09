import { consultaPedidosGestionSchema, type OrdenPedidosGestion } from '@shopcart/shared';
import { Link } from 'react-router';
import { EstadoPedido } from '../../../shared/componentes/EstadoPedido';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { FiltrosPedidosGestion } from '../componentes/FiltrosPedidosGestion';
import { usePedidosGestion } from '../hooks/usePedidosGestion';
import type { ResumenGestion } from '../pedidos.api';
import { conId, RUTAS } from '../../../shared/rutas';

const rutaPedidoGestion = (idPedido: number) => conId(RUTAS.pedidoGestion, idPedido);

const columnas: ColumnaTabla<ResumenGestion, OrdenPedidosGestion['orden']>[] = [
  {
    id: 'numero',
    etiqueta: 'Pedido',
    prioridad: 1,
    ordenable: 'numero',
    celda: (p) => (
      <Link
        to={rutaPedidoGestion(p.idPedido)}
        className="texto-pequeno-fuerte text-primary hover:underline"
      >
        {p.numeroPedido}
      </Link>
    ),
  },
  {
    id: 'fecha',
    etiqueta: 'Fecha',
    prioridad: 1,
    ordenable: 'fecha',
    celda: (p) => <span className="whitespace-nowrap">{formatearFechaHora(p.fechaPago)}</span>,
  },
  {
    id: 'cliente',
    etiqueta: 'Cliente',
    prioridad: 1,
    // Figma 26:519: el nombre; el correo está en el detalle y el filtro lo busca.
    celda: (p) => p.cliente.nombre,
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    ordenable: 'estado',
    celda: (p) => <EstadoPedido estado={p.estado} />,
  },
  {
    id: 'total',
    etiqueta: 'Total',
    prioridad: 1,
    alineacion: 'fin',
    ordenable: 'total',
    celda: (p) => <Monto valor={p.total} className="texto-pequeno-fuerte" />,
  },
];

/**
 * M8-H02 (Figma 26:519): `/backoffice/pedidos`, todos los pedidos con filtros, orden y paginación del servidor
 * (RF-08, FE-06). Operador y Administrador.
 */
export function GestionPedidosPagina() {
  useTituloPagina('Pedidos');
  const parametros = useParametrosUrl(consultaPedidosGestionSchema);
  const pedidos = usePedidosGestion(parametros.valores);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="titulo-1">Pedidos</h1>
        <p className="texto-base text-muted-foreground">
          Prepara, despacha y da seguimiento a los pedidos pagados.
        </p>
      </div>
      <TablaServidor
        titulo="Pedidos"
        columnas={columnas}
        consulta={pedidos}
        parametros={parametros}
        claveFila={(p) => p.idPedido}
        vacio={{
          titulo: 'Todavía no hay pedidos',
          descripcion: 'Aquí aparecerán cuando los clientes paguen.',
        }}
        filtros={<FiltrosPedidosGestion parametros={parametros} />}
      />
    </div>
  );
}
