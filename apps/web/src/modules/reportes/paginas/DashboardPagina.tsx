import { FiltroRangoFechas } from '../../../shared/componentes/FiltroRangoFechas';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { consultaDashboardSchema, rangoDe } from '../consultaDashboard';
import {
  ReporteTopProductos,
  ReporteVentasPorCategoria,
  ReporteVentasPorPeriodo,
} from '../componentes/ReportesDeVentas';
import { IndicadorTiempoReal } from '../componentes/IndicadorTiempoReal';
import { TablaCarritos } from '../componentes/TablaCarritos';
import { TarjetasResumen } from '../componentes/TarjetasResumen';
import { useTiempoRealReportes } from '../hooks/useTiempoRealReportes';

/**
 * M11-H01 (RF-08, FE-07): el dashboard del Administrador. El rango de días de Guatemala va en la URL y lo usan todos
 * los reportes; sin rango, el backend usa los últimos 30 días y el resumen dice cuáles fueron. Con el dashboard
 * abierto, los reportes se actualizan solos cuando el backend avisa un cambio (M11-H02).
 */
export function DashboardPagina() {
  useTituloPagina('Dashboard');
  const parametros = useParametrosUrl(consultaDashboardSchema);
  const rango = rangoDe(parametros.valores);
  const tiempoReal = useTiempoRealReportes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="titulo-1">Dashboard</h1>
          <p className="texto-base text-muted-foreground">Ventas y carritos de la tienda.</p>
          <IndicadorTiempoReal estado={tiempoReal} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:w-80">
          <FiltroRangoFechas parametros={parametros} />
        </div>
      </div>
      <TarjetasResumen rango={rango} />
      <ReporteVentasPorPeriodo parametros={parametros} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ReporteVentasPorCategoria rango={rango} />
        <ReporteTopProductos rango={rango} />
      </div>
      <TablaCarritos parametros={parametros} />
    </div>
  );
}
