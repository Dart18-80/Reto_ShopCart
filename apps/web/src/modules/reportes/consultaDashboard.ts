import {
  consultaCarritosSchema,
  consultaVentasSchema,
  type ConsultaCarritos,
  type ConsultaVentas,
  type RangoDeFechas,
} from '@shopcart/shared';
import { z } from 'zod';

/** 05 §11: las ventas por periodo se ven en quetzales o en número de pedidos, nunca las dos a la vez (sin doble eje). */
export const METRICAS_VENTAS = ['quetzales', 'pedidos'] as const;
export type MetricaVentas = (typeof METRICAS_VENTAS)[number];

/**
 * M11-H01 (FE-06): lo navegable del dashboard vive en la URL. El rango es el de todos los reportes (sin rango, el
 * backend usa los últimos 30 días); la agrupación y la métrica son de las ventas por periodo, y la página y el orden,
 * de los carritos abandonados. Parte de los esquemas de consulta del backend (FE-03).
 */
export const consultaDashboardSchema = consultaCarritosSchema.safeExtend({
  agrupacion: consultaVentasSchema.shape.agrupacion,
  metrica: z.enum(METRICAS_VENTAS).default('quetzales'),
});

export type ConsultaDashboard = z.output<typeof consultaDashboardSchema>;

export const rangoDe = ({ desde, hasta }: ConsultaDashboard): RangoDeFechas => ({ desde, hasta });

export const consultaVentasDe = (consulta: ConsultaDashboard): ConsultaVentas => ({
  ...rangoDe(consulta),
  agrupacion: consulta.agrupacion,
});

export const consultaCarritosDe = (consulta: ConsultaDashboard): ConsultaCarritos => ({
  ...rangoDe(consulta),
  pagina: consulta.pagina,
  tamano: consulta.tamano,
  orden: consulta.orden,
  direccion: consulta.direccion,
});
