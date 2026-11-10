import { FiltroRangoFechas } from '../../../shared/componentes/FiltroRangoFechas';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useRevelarAlEntrar } from '../../../shared/hooks/useRevelarAlEntrar';
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
import { EncabezadoPagina } from '../../../shared/componentes/EncabezadoPagina';

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
  // Los reportes bajo el resumen suben con fundido la primera vez que llegan a la vista.
  const revelarPeriodo = useRevelarAlEntrar<HTMLDivElement>();
  const revelarDistribucion = useRevelarAlEntrar<HTMLDivElement>();
  const revelarCarritos = useRevelarAlEntrar<HTMLDivElement>();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Dashboard"
        descripcion="Ventas y carritos de la tienda."
        acciones={
          <div className="grid w-full grid-cols-2 gap-4 sm:w-80">
            <FiltroRangoFechas parametros={parametros} />
          </div>
        }
      >
        <IndicadorTiempoReal estado={tiempoReal} />
      </EncabezadoPagina>
      <TarjetasResumen rango={rango} />
      <div ref={revelarPeriodo} className="revelar-al-entrar">
        <ReporteVentasPorPeriodo parametros={parametros} />
      </div>
      <div ref={revelarDistribucion} className="revelar-al-entrar grid gap-6 lg:grid-cols-2">
        <ReporteVentasPorCategoria rango={rango} />
        <ReporteTopProductos rango={rango} />
      </div>
      <div ref={revelarCarritos} className="revelar-al-entrar">
        <TablaCarritos parametros={parametros} />
      </div>
    </div>
  );
}
