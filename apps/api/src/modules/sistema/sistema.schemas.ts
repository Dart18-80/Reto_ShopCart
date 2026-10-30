import { z } from '../../shared/openapi/zod.js';

const estadoSaludSchema = z
  .object({
    estado: z.enum(['ok', 'degradado', 'caido']),
    instancia: z.string().openapi({ example: 'api-1' }),
    baseDatos: z.union([
      z.object({
        estado: z.literal('ok'),
        versionServidor: z.string().openapi({ example: '16.0.4305.5' }),
        fechaHoraUtc: z.iso.datetime(),
      }),
      z.object({ estado: z.literal('caida') }),
    ]),
    redis: z.enum(['ok', 'degradado']),
  })
  .openapi('EstadoSalud');

export const respuestaSaludSchema = z.object({ datos: estadoSaludSchema });
