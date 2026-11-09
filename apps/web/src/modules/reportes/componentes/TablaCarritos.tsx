import type { OrdenCarritos } from '@shopcart/shared';
import { useId } from 'react';
import { FechaHora } from '../../../shared/componentes/FechaHora';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearCantidad } from '../../../shared/formato/conteo';
import type { ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { DialogoExportar } from '../../exportaciones';
import { consultaCarritosDe, rangoDe, type ConsultaDashboard } from '../consultaDashboard';
import { useCarritosAbandonados } from '../hooks/useReportes';
import type { CarritoAbandonado } from '../reportes.api';

const COLUMNAS: readonly ColumnaTabla<CarritoAbandonado, OrdenCarritos['orden']>[] = [
  {
    id: 'cliente',
    etiqueta: 'Cliente',
    prioridad: 1,
    celda: (c) =>
      c.cliente ? (
        <span className="texto-pequeno-fuerte">{c.cliente.nombre}</span>
      ) : (
        <span className="text-muted-foreground">Invitado</span>
      ),
  },
  {
    id: 'actividad',
    etiqueta: 'Última actividad',
    prioridad: 1,
    // M6-H01: «inactividad» descendente es la actividad más antigua primero.
    ordenable: 'inactividad',
    celda: (c) => <FechaHora valor={c.fechaUltimaActividad} />,
  },
  { id: 'lineas', etiqueta: 'Líneas', prioridad: 2, celda: (c) => formatearCantidad(c.lineas) },
  {
    id: 'unidades',
    etiqueta: 'Unidades',
    prioridad: 2,
    celda: (c) => formatearCantidad(c.unidades),
  },
  {
    id: 'monto',
    etiqueta: 'Monto potencial',
    prioridad: 1,
    ordenable: 'total',
    alineacion: 'fin',
    celda: (c) => <Monto valor={c.montoPotencial} />,
  },
];

/**
 * N-13: los carritos abandonados del periodo en `TablaServidor`, con la página y el orden de M6-H01 en la URL. Su
 * único filtro es el rango del dashboard: la agrupación y la métrica de las ventas no cuentan como filtros aquí.
 */
export function TablaCarritos({ parametros }: { parametros: ParametrosUrl<ConsultaDashboard> }) {
  const idTitulo = useId();
  const { valores, cambiar } = parametros;
  const carritos = useCarritosAbandonados(consultaCarritosDe(valores));
  const parametrosDeLaTabla: ParametrosUrl<ConsultaDashboard> = {
    ...parametros,
    hayFiltros: valores.desde !== undefined || valores.hasta !== undefined,
    limpiarFiltros: () => {
      cambiar({ desde: undefined, hasta: undefined });
    },
  };

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={idTitulo} className="titulo-2">
            Carritos abandonados
          </h2>
          <p className="texto-pequeno text-muted-foreground">
            Carritos sin actividad reciente, con lo que habrían sumado.
          </p>
        </div>
        {/* Se exportan todos los del rango, del mayor monto potencial al menor; la página y el orden son de la vista. */}
        <DialogoExportar reporte="carritos-abandonados" filtros={rangoDe(valores)} />
      </div>
      <TablaServidor
        titulo="Carritos abandonados"
        columnas={COLUMNAS}
        consulta={carritos}
        parametros={parametrosDeLaTabla}
        claveFila={(c) => c.idCarrito}
        vacio={{ titulo: 'Ningún carrito abandonado en este periodo' }}
      />
    </section>
  );
}
