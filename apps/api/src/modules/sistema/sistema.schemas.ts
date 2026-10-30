import { z } from '../../shared/openapi/zod.js';

// Solo estados: el endpoint es público y no expone la versión ni la hora de SQL Server.
export const estadoSaludSchema = z
  .object({
    estado: z.enum(['ok', 'degradado', 'caido']).openapi({
      description:
        'ok: todo responde · degradado: Redis caído, se sigue vendiendo (RNF-2) · caido: sin base',
    }),
    instancia: z.string().openapi({ example: 'api-1' }),
    baseDatos: z.enum(['ok', 'caida']),
    redis: z.enum(['ok', 'degradado']),
  })
  .openapi('EstadoSalud');

export const respuestaSaludSchema = z.object({ datos: estadoSaludSchema });
