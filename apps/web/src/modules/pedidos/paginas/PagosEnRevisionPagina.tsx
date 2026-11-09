import { consultaPaginacionSchema } from '@shopcart/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { DialogoResolverPago } from '../componentes/DialogoResolverPago';
import { nombreDelEstadoReembolso } from '../componentes/EstadoReembolso';
import { usePagosEnRevision } from '../hooks/useRevisionManual';
import type { PagoEnRevision, PagoResuelto } from '../pedidos.api';
import { RESOLUCION } from '../revision';
import { conId, RUTAS } from '../../../shared/rutas';

const CAUSA: Record<PagoEnRevision['causa'], string> = {
  AutorizacionInexistente: 'La autorización ya no existía',
  CobroSinPedido: 'Cobro capturado sin pedido',
};

const tarjetaDe = ({ tarjeta }: PagoEnRevision) =>
  tarjeta.marca && tarjeta.ultimosDigitos ? `${tarjeta.marca} •••• ${tarjeta.ultimosDigitos}` : '—';

const columnas = (
  alResolver: (resultado: PagoResuelto) => void,
): ColumnaTabla<PagoEnRevision, never>[] => [
  {
    id: 'intento',
    etiqueta: 'Intento',
    prioridad: 1,
    celda: (p) => `#${String(p.idIntentoPago)}`,
  },
  {
    id: 'pedido',
    etiqueta: 'Pedido',
    prioridad: 1,
    celda: (p) =>
      p.idPedido !== null && p.numeroPedido !== null ? (
        <Link
          to={conId(RUTAS.pedidoGestion, p.idPedido)}
          className="texto-pequeno-fuerte text-primary hover:underline"
        >
          {p.numeroPedido}
        </Link>
      ) : (
        <span className="text-muted-foreground">Sin pedido</span>
      ),
  },
  {
    id: 'cliente',
    etiqueta: 'Cliente',
    prioridad: 2,
    celda: (p) => (
      <span className="flex flex-col">
        <span>{p.cliente.nombre}</span>
        <span className="texto-nota text-muted-foreground">{p.cliente.correo}</span>
      </span>
    ),
  },
  { id: 'causa', etiqueta: 'Causa', prioridad: 1, celda: (p) => CAUSA[p.causa] },
  { id: 'tarjeta', etiqueta: 'Tarjeta', prioridad: 3, celda: tarjetaDe },
  {
    id: 'fecha',
    etiqueta: 'Fecha',
    prioridad: 2,
    celda: (p) => <span className="whitespace-nowrap">{formatearFechaHora(p.fecha)}</span>,
  },
  {
    id: 'monto',
    etiqueta: 'Monto',
    prioridad: 1,
    alineacion: 'fin',
    celda: (p) => <Monto valor={p.monto} className="texto-pequeno-fuerte" />,
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (p) => <DialogoResolverPago pago={p} alResolver={alResolver} />,
  },
];

const resumenDe = ({ idIntentoPago, resolucion, reembolso }: PagoResuelto) =>
  [
    `Resolvimos el intento #${String(idIntentoPago)} como «${RESOLUCION[resolucion].nombre}».`,
    reembolso &&
      `El reembolso #${String(reembolso.idReembolso)} quedó ${nombreDelEstadoReembolso(reembolso.estado).toLowerCase()}.`,
  ]
    .filter(Boolean)
    .join(' ');

/**
 * M8-H05 (E9-H04): `/backoffice/pagos-en-revision`, solo Admin. Los pagos que la conciliación no pudo cerrar sola,
 * para resolverlos con la evidencia de la pasarela.
 */
export function PagosEnRevisionPagina() {
  useTituloPagina('Pagos en revisión');
  const parametros = useParametrosUrl(consultaPaginacionSchema);
  const pagos = usePagosEnRevision(parametros.valores);
  const [resuelto, setResuelto] = useState<PagoResuelto | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display-titulo-1">Pagos en revisión</h1>
        <p className="texto-base text-muted-foreground">
          Cobros que la conciliación no pudo cerrar sola: resuélvelos con lo que dice la pasarela.
        </p>
      </div>
      {resuelto && <Aviso tipo="exito">{resumenDe(resuelto)}</Aviso>}
      <TablaServidor
        titulo="Pagos en revisión"
        columnas={columnas(setResuelto)}
        consulta={pagos}
        parametros={parametros}
        claveFila={(p) => p.idIntentoPago}
        vacio={{
          titulo: 'No hay pagos en revisión',
          descripcion: 'Todos los cobros están conciliados.',
        }}
      />
    </div>
  );
}
