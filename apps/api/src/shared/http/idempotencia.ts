import { createHash } from 'node:crypto';
import { z } from '../openapi/zod.js';

const ENCABEZADO = 'idempotency-key';
const llaveSchema = z.uuid('Idempotency-Key debe ser un UUID.');

/** N-03: Idempotency-Key obligatoria (pagos): misma llave, misma respuesta. */
export const encabezadoIdempotenciaSchema = z.object({ [ENCABEZADO]: llaveSchema });

/** E5-H03: Idempotency-Key opcional (entradas y ajustes de inventario). */
export const encabezadoIdempotenciaOpcionalSchema = z.object({
  [ENCABEZADO]: llaveSchema.optional(),
});

export const ENCABEZADO_IDEMPOTENCIA = ENCABEZADO;

/** E5-H03: lo que identifica una solicitud idempotente: misma llave con otro hash → 422. */
export interface SolicitudIdempotente {
  llave: string;
  hash: Buffer;
}

/** El SHA-256 del contenido ya validado (JSON en el orden del esquema) y de la operación. */
export function solicitudIdempotente(
  llave: string | undefined,
  operacion: string,
  contenido: unknown,
): SolicitudIdempotente | null {
  if (llave === undefined) return null;
  const hash = createHash('sha256').update(JSON.stringify({ operacion, contenido })).digest();
  return { llave, hash };
}
