import { consultaVentasSchema, type Agrupacion, type ReporteDashboard } from '@shopcart/shared';
import { formatearFechaCalendario } from '../../shared/formato/fecha';

/** El nombre de cada reporte, igual que el título de su panel en el dashboard. */
export const NOMBRE_DEL_REPORTE: Record<ReporteDashboard, string> = {
  resumen: 'Resumen',
  ventas: 'Ventas por periodo',
  'ventas-por-categoria': 'Ventas por categoría',
  'top-productos': 'Top 10 productos',
  'carritos-abandonados': 'Carritos abandonados',
};

const POR_AGRUPACION: Record<Agrupacion, string> = {
  dia: 'por día',
  semana: 'por semana',
  mes: 'por mes',
};

function describirRango(desde: string | undefined, hasta: string | undefined): string {
  if (desde === undefined) {
    return hasta === undefined ? 'Últimos 30 días' : `Hasta el ${formatearFechaCalendario(hasta)}`;
  }
  if (hasta === undefined) return `Desde el ${formatearFechaCalendario(desde)}`;
  return `Del ${formatearFechaCalendario(desde)} al ${formatearFechaCalendario(hasta)}`;
}

/**
 * Los filtros guardados de una exportación, como se leen: «Del 1 nov 2026 al 8 nov 2026 · por semana». Sin rango, el
 * backend usó los últimos 30 días. La agrupación solo existe en las ventas por periodo.
 */
export function describirFiltros(reporte: ReporteDashboard, filtros: unknown): string {
  const leidos = consultaVentasSchema.safeParse(filtros);
  if (!leidos.success) return 'Filtros no reconocidos';
  const { desde, hasta, agrupacion } = leidos.data;
  const rango = describirRango(desde, hasta);
  return reporte === 'ventas' ? `${rango} · ${POR_AGRUPACION[agrupacion]}` : rango;
}
