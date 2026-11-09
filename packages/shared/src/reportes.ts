import { z } from 'zod';
import { consultaPaginacionSchema, rangoDeFechasSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';

/** RF-08: los reportes del dashboard; también son los que se exportan (CK_SolicitudExportacion_Reporte). */
export const REPORTES_DASHBOARD = [
  'resumen',
  'ventas',
  'ventas-por-categoria',
  'top-productos',
  'carritos-abandonados',
] as const;
export type ReporteDashboard = (typeof REPORTES_DASHBOARD)[number];

/** A-11: una versión por dominio de datos; cada escritura incrementa la de los dominios que cambia (01 §9). */
export const DOMINIOS_REPORTES = ['ventas', 'carritos'] as const;
export type DominioReportes = (typeof DOMINIOS_REPORTES)[number];

/**
 * De qué dominios depende cada reporte. La API la usa para su caché y la web para saber qué volver a pedir con cada
 * aviso del tiempo real (FE-11): una sola tabla para las dos. El resumen depende de los dos porque también cuenta
 * los carritos abandonados y su monto potencial.
 */
export const DEPENDENCIAS_REPORTES: Record<ReporteDashboard, readonly DominioReportes[]> = {
  resumen: ['ventas', 'carritos'],
  ventas: ['ventas'],
  'ventas-por-categoria': ['ventas'],
  'top-productos': ['ventas'],
  'carritos-abandonados': ['carritos'],
};

/** RF-08: cómo se agrupan las ventas por periodo (el día, la semana desde el lunes o el mes). */
export const AGRUPACIONES = ['dia', 'semana', 'mes'] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number];

/** RF-08 (M11-H01 la usa en el dashboard, FE-03): el rango de días de Guatemala (A-12) y la agrupación. */
export const consultaVentasSchema = rangoDeFechasSchema.safeExtend({
  agrupacion: z.enum(AGRUPACIONES).default('dia'),
});

// M6-H01: por defecto, del mayor monto potencial al menor (lo supone la exportación); inactividad desc es la
// última actividad más antigua primero.
export const ordenCarritosSchema = ordenConsultaSchema(['inactividad', 'total'], 'total', 'desc');

/** RF-08: los carritos abandonados del rango, paginados y con el orden de M6-H01. */
export const consultaCarritosSchema = rangoDeFechasSchema.safeExtend({
  ...consultaPaginacionSchema.shape,
  ...ordenCarritosSchema.shape,
});

export type ConsultaVentas = z.infer<typeof consultaVentasSchema>;
export type OrdenCarritos = z.infer<typeof ordenCarritosSchema>;
export type ConsultaCarritos = z.infer<typeof consultaCarritosSchema>;
