import { z } from 'zod';

/** RF-08: los formatos de una exportación (Excel o PDF). */
export const FORMATOS_EXPORTACION = ['xlsx', 'pdf'] as const;
export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

/**
 * E8 (M11-H03 la usa en el dashboard, FE-03): la solicitud de exportación de un reporte. Los filtros son los del
 * propio reporte y el backend los valida con su esquema (el mismo de la consulta del dashboard).
 */
export const solicitarExportacionSchema = z
  .object({
    formato: z.enum(FORMATOS_EXPORTACION),
    filtros: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SolicitarExportacion = z.infer<typeof solicitarExportacionSchema>;
