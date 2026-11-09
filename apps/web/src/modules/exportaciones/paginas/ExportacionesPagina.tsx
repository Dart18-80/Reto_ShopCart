import { consultaPaginacionSchema } from '@shopcart/shared';
import { Link } from 'react-router';
import { FechaHora } from '../../../shared/componentes/FechaHora';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { DescargarExportacion, TextoEstadoExportacion } from '../componentes/EstadoExportacion';
import { describirFiltros, NOMBRE_DEL_REPORTE } from '../descripciones';
import type { Exportacion } from '../exportaciones.api';
import { useExportaciones } from '../hooks/useExportaciones';
import { RUTAS } from '../../../shared/rutas';

const NOMBRE_DEL_FORMATO: Record<Exportacion['formato'], string> = { xlsx: 'Excel', pdf: 'PDF' };

// La lista no tiene orden propio: el backend la da de la más reciente a la más antigua.
const COLUMNAS: readonly ColumnaTabla<Exportacion, never>[] = [
  {
    id: 'reporte',
    etiqueta: 'Reporte',
    prioridad: 1,
    celda: (e) => (
      <span className="flex flex-col">
        <span className="texto-pequeno-fuerte">{NOMBRE_DEL_REPORTE[e.reporte]}</span>
        <span className="texto-nota text-muted-foreground">
          {describirFiltros(e.reporte, e.filtros)}
        </span>
      </span>
    ),
  },
  { id: 'formato', etiqueta: 'Formato', prioridad: 1, celda: (e) => NOMBRE_DEL_FORMATO[e.formato] },
  {
    id: 'fecha',
    etiqueta: 'Solicitada',
    prioridad: 2,
    celda: (e) => <FechaHora valor={e.fechaCreacion} />,
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (e) => <TextoEstadoExportacion exportacion={e} />,
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (e) => <DescargarExportacion exportacion={e} />,
  },
];

/**
 * M11-H03: «Mis exportaciones» (solo Admin). Mientras alguna está en cola o generándose, la lista se vuelve a
 * pedir sola; la descarga aparece cuando el backend da el enlace del archivo.
 */
export function ExportacionesPagina() {
  useTituloPagina('Mis exportaciones');
  const parametros = useParametrosUrl(consultaPaginacionSchema);
  const exportaciones = useExportaciones(parametros.valores);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="titulo-1">Mis exportaciones</h1>
        <p className="texto-base text-muted-foreground">
          Los reportes que pediste en Excel o PDF. Se piden desde el{' '}
          <Link to={RUTAS.dashboard} className="text-primary underline">
            dashboard
          </Link>
          .
        </p>
      </div>
      <TablaServidor
        titulo="Mis exportaciones"
        columnas={COLUMNAS}
        consulta={exportaciones}
        parametros={parametros}
        claveFila={(e) => e.idExportacion}
        vacio={{
          titulo: 'Todavía no has exportado ningún reporte',
          descripcion: 'Usa «Exportar» en cualquier reporte del dashboard.',
        }}
      />
    </div>
  );
}
