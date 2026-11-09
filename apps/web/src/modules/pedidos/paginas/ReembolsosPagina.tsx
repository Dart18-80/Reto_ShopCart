import {
  consultaReembolsosSchema,
  ESTADOS_REEMBOLSO,
  type ConsultaReembolsos,
  type EstadoReembolso,
} from '@shopcart/shared';
import { useId } from 'react';
import { Link } from 'react-router';
import { Aviso } from '../../../shared/componentes/Aviso';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { useParametrosUrl, type ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { DialogoResolverReembolso } from '../componentes/DialogoResolverReembolso';
import {
  EstadoReembolso as InsigniaEstado,
  nombreDelEstadoReembolso,
} from '../componentes/EstadoReembolso';
import { useReembolsos, useReintentarReembolso } from '../hooks/useRevisionManual';
import type { Reembolso } from '../pedidos.api';
import { conId, RUTAS } from '../../../shared/rutas';
import { EncabezadoPagina } from '../../../shared/componentes/EncabezadoPagina';

const ORIGEN: Record<Reembolso['origen'], string> = {
  Cancelacion: 'Cancelación',
  Devolucion: 'Devolución',
  SinPedido: 'Cobro sin pedido',
};

const esEstado = (valor: string): valor is EstadoReembolso =>
  (ESTADOS_REEMBOLSO as readonly string[]).includes(valor);

function FiltroEstado({ parametros }: { parametros: ParametrosUrl<ConsultaReembolsos> }) {
  const id = useId();
  const { valores, cambiar } = parametros;
  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        Estado
      </label>
      <select
        id={id}
        value={valores.estado ?? ''}
        onChange={(evento) => {
          const valor = evento.target.value;
          cambiar({ estado: esEstado(valor) ? valor : undefined });
        }}
        className={CLASE_SELECT}
      >
        <option value="">Todos</option>
        {ESTADOS_REEMBOLSO.map((estado) => (
          <option key={estado} value={estado}>
            {nombreDelEstadoReembolso(estado)}
          </option>
        ))}
      </select>
    </div>
  );
}

const pedidoDe = (r: Reembolso) =>
  r.idPedido !== null && r.numeroPedido !== null ? (
    <Link
      to={conId(RUTAS.pedidoGestion, r.idPedido)}
      className="texto-pequeno-fuerte text-primary hover:underline"
    >
      {r.numeroPedido}
    </Link>
  ) : (
    <span className="text-muted-foreground">{`Intento ${String(r.idIntentoPago ?? '')}`}</span>
  );

const columnas = (
  reintentar: (idReembolso: number) => void,
  ocupado: boolean,
): ColumnaTabla<Reembolso, never>[] => [
  { id: 'id', etiqueta: 'Reembolso', prioridad: 1, celda: (r) => `#${String(r.idReembolso)}` },
  { id: 'pedido', etiqueta: 'Pedido', prioridad: 1, celda: pedidoDe },
  { id: 'origen', etiqueta: 'Origen', prioridad: 2, celda: (r) => ORIGEN[r.origen] },
  {
    id: 'fecha',
    etiqueta: 'Fecha',
    prioridad: 2,
    celda: (r) => <span className="whitespace-nowrap">{formatearFechaHora(r.fechaCreacion)}</span>,
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (r) => (
      <span className="flex flex-col items-start gap-1">
        <InsigniaEstado estado={r.estado} />
        {r.estado === 'Fallido' && r.ultimoError && (
          <span className="texto-nota text-muted-foreground">{`${r.ultimoError} (${String(r.intentos)} intentos)`}</span>
        )}
        {r.estado === 'ResueltoManual' && r.referenciaResolucion && (
          <span className="texto-nota text-muted-foreground">{`Ref. ${r.referenciaResolucion}`}</span>
        )}
      </span>
    ),
  },
  {
    id: 'monto',
    etiqueta: 'Monto',
    prioridad: 1,
    alineacion: 'fin',
    celda: (r) => <Monto valor={r.monto} className="texto-pequeno-fuerte" />,
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    // M8-H05: el backend dice qué se puede hacer con cada uno (las mismas funciones que exigen sus SPs).
    celda: (r) => (
      <span className="inline-flex gap-1">
        {r.puedeReintentar && (
          <Button
            variant="link"
            size="sm"
            disabled={ocupado}
            aria-label={`Reintentar el reembolso ${String(r.idReembolso)}`}
            onClick={() => {
              reintentar(r.idReembolso);
            }}
          >
            Reintentar
          </Button>
        )}
        {r.puedeResolver && <DialogoResolverReembolso reembolso={r} />}
      </span>
    ),
  },
];

/**
 * M8-H05 (E9-H04): `/backoffice/reembolsos`, solo Admin. Los reembolsos con su estado; un Fallido se reintenta
 * (con la misma llave: nunca reembolsa dos veces) o se resuelve a mano. El estado nuevo llega sin recargar.
 */
export function ReembolsosPagina() {
  useTituloPagina('Reembolsos');
  const parametros = useParametrosUrl(consultaReembolsosSchema);
  const reembolsos = useReembolsos(parametros.valores);
  const reintento = useReintentarReembolso();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Reembolsos"
        descripcion="Las devoluciones de dinero de cancelaciones y devoluciones; los fallidos se reintentan o se resuelven a mano."
      />
      {reintento.error && <Aviso tipo="error">{reintento.error.mensaje}</Aviso>}
      {reintento.data && (
        <Aviso tipo={reintento.data.estado === 'Fallido' ? 'advertencia' : 'exito'}>
          {`Reintentamos el reembolso #${String(reintento.data.idReembolso)}: quedó ${nombreDelEstadoReembolso(reintento.data.estado).toLowerCase()}.`}
        </Aviso>
      )}
      <TablaServidor
        titulo="Reembolsos"
        columnas={columnas((id) => {
          reintento.mutate(id);
        }, reintento.isPending)}
        consulta={reembolsos}
        parametros={parametros}
        claveFila={(r) => r.idReembolso}
        vacio={{ titulo: 'Todavía no hay reembolsos' }}
        filtros={<FiltroEstado parametros={parametros} />}
      />
    </div>
  );
}
