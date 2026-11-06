import { useState } from 'react';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Paginacion } from '../../../shared/componentes/Paginacion';
import { TablaLocal, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { cn } from '../../../shared/ui/cn';
import { useKardex } from '../hooks/useMovimientos';
import type { Movimiento } from '../inventario.api';

const MOVIMIENTO: Record<Movimiento['tipo'], string> = {
  EntradaCompra: 'Entrada por compra',
  SalidaVenta: 'Salida por venta',
  AjustePositivo: 'Ajuste positivo',
  AjusteNegativo: 'Ajuste negativo',
  ReingresoCancelacion: 'Reingreso por cancelación',
  ReingresoDevolucion: 'Reingreso por devolución',
};

const entero = (valor: number) => <span className="tabular-nums">{String(valor)}</span>;

const columnas: ColumnaTabla<Movimiento, never>[] = [
  {
    id: 'fecha',
    etiqueta: 'Fecha',
    prioridad: 1,
    celda: (m) => <span className="whitespace-nowrap">{formatearFechaHora(m.fecha)}</span>,
  },
  {
    id: 'movimiento',
    etiqueta: 'Movimiento',
    prioridad: 1,
    // La referencia (el pedido, la devolución o la factura) o, si no hay, el motivo que escribió el Operador.
    celda: (m) => (
      <span className="flex flex-col">
        <span>{MOVIMIENTO[m.tipo]}</span>
        <span className="texto-nota text-muted-foreground">{m.referencia ?? m.motivo}</span>
      </span>
    ),
  },
  {
    id: 'cantidad',
    etiqueta: 'Cantidad',
    prioridad: 1,
    alineacion: 'fin',
    // El signo lo manda el backend con el tipo del movimiento; aquí solo se escribe.
    celda: (m) => (
      <span className={cn('tabular-nums', m.signo < 0 ? 'text-oferta' : 'text-exito')}>
        {`${m.signo < 0 ? '−' : '+'}${String(m.cantidad)}`}
      </span>
    ),
  },
  {
    id: 'anterior',
    etiqueta: 'Anterior',
    prioridad: 1,
    alineacion: 'fin',
    celda: (m) => entero(m.existenciaAnterior),
  },
  {
    id: 'resultante',
    etiqueta: 'Resultante',
    prioridad: 1,
    alineacion: 'fin',
    celda: (m) => entero(m.existenciaResultante),
  },
  { id: 'usuario', etiqueta: 'Usuario', prioridad: 2, celda: (m) => m.usuario.nombre },
];

const SIN_MOVIMIENTOS = { titulo: 'Sin movimientos todavía' };

/**
 * M7-H02 (Figma 48:1617): el kardex de una variante (N-07), paginado por el servidor. La página es estado del
 * diálogo, no de la URL: cerrar el diálogo la olvida.
 */
export function KardexVariante({ idVariante }: { idVariante: number }) {
  const [pagina, setPagina] = useState(1);
  const kardex = useKardex(idVariante, pagina);
  return (
    <section aria-labelledby={`kardex-${String(idVariante)}`} className="flex flex-col gap-3">
      <h3 id={`kardex-${String(idVariante)}`} className="texto-pequeno-fuerte">
        Kardex
      </h3>
      <EstadoVista consulta={kardex} vacio={SIN_MOVIMIENTOS}>
        {(respuesta) => (
          <>
            <TablaLocal
              titulo="Kardex"
              columnas={columnas}
              filas={respuesta.datos}
              claveFila={(m) => m.idMovimientoKardex}
            />
            {respuesta.paginacion.totalPaginas > 1 && (
              <Paginacion paginacion={respuesta.paginacion} onPagina={setPagina} />
            )}
          </>
        )}
      </EstadoVista>
    </section>
  );
}
