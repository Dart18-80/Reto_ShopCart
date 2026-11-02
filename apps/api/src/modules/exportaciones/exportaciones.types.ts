import type { Decimal } from 'decimal.js';

// Los reportes del dashboard que se exportan (RF-08); el mismo CHECK de SolicitudExportacion.Reporte.
export const REPORTES_EXPORTABLES = [
  'resumen',
  'ventas',
  'ventas-por-categoria',
  'top-productos',
  'carritos-abandonados',
] as const;
export type ReporteExportable = (typeof REPORTES_EXPORTABLES)[number];

export const FORMATOS = ['xlsx', 'pdf'] as const;
export type Formato = (typeof FORMATOS)[number];

export const ESTADOS_EXPORTACION = [
  'Pendiente',
  'Procesando',
  'Completada',
  'Fallida',
  'Expirada',
] as const;
export type EstadoExportacion = (typeof ESTADOS_EXPORTACION)[number];

export interface Exportacion {
  idExportacion: number;
  reporte: ReporteExportable;
  formato: Formato;
  filtros: Record<string, unknown>;
  estado: EstadoExportacion;
  intentos: number;
  error: string | null;
  /** El nombre del archivo en el almacén; nunca sale en una respuesta. */
  referenciaArchivo: string | null;
  tamanoBytes: number | null;
  fechaCreacion: Date;
  fechaFinalizacion: Date | null;
  fechaExpiracion: Date | null;
}

export interface ExportacionSolicitada {
  exportacion: Exportacion;
  /** false si se agrupó con una igual que ya existía. */
  nueva: boolean;
}

/** Una exportación que este proceso tomó de la cola, con su arrendamiento (fencing, A-24). */
export interface ExportacionTomada {
  idExportacion: number;
  idUsuario: number;
  reporte: ReporteExportable;
  formato: Formato;
  filtros: Record<string, unknown>;
  intentos: number;
  token: string;
}

/** Un archivo listo para descargar. */
export interface ArchivoExportado {
  contenido: NodeJS.ReadableStream;
  nombreDescarga: string;
  tipoContenido: string;
  tamanoBytes: number;
}

/** Un valor de una celda: los montos como Decimal y las fechas como Date; los generadores deciden el formato. */
export type Celda = string | number | Decimal | Date | null;

/** La tabla neutra que entienden todos los generadores (Excel y PDF). */
export interface TablaReporte {
  titulo: string;
  descripcion: string;
  columnas: string[];
  filas: Celda[][];
  totales: Celda[] | null;
}
