import {
  DEPENDENCIAS_REPORTES,
  REPORTES_DASHBOARD,
  type ConsultaCarritos,
  type ConsultaVentas,
  type DominioReportes,
  type RangoDeFechas,
  type ReporteDashboard,
} from '@shopcart/shared';

const seccion = (reporte: ReporteDashboard) => ['reportes', reporte] as const;

export const reportesKeys = {
  todo: ['reportes'] as const,
  seccion,
  resumen: (rango: RangoDeFechas) => [...seccion('resumen'), rango] as const,
  ventas: (consulta: ConsultaVentas) => [...seccion('ventas'), consulta] as const,
  categorias: (rango: RangoDeFechas) => [...seccion('ventas-por-categoria'), rango] as const,
  top: (rango: RangoDeFechas) => [...seccion('top-productos'), rango] as const,
  carritos: (consulta: ConsultaCarritos) => [...seccion('carritos-abandonados'), consulta] as const,
};

/**
 * 05 §11 (A-11): los reportes que dependen de un dominio, de la misma tabla que usa la caché de la API
 * (DEPENDENCIAS_REPORTES): un aviso de ese dominio los vuelve a pedir.
 */
export const reportesDelDominio = (dominio: DominioReportes): readonly ReporteDashboard[] =>
  REPORTES_DASHBOARD.filter((reporte) => DEPENDENCIAS_REPORTES[reporte].includes(dominio));
