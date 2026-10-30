import type { z } from '../../shared/openapi/zod.js';
import type { estadoSaludSchema } from './sistema.schemas.js';

/** Puerto hacia Redis para el health; el adaptador vive en shared/adapters/redis.ts. */
export interface VerificadorRedis {
  ping(): Promise<boolean>;
}

export interface ServidorBaseDatos {
  versionServidor: string;
  fechaHoraUtc: Date;
}

export type EstadoSalud = z.infer<typeof estadoSaludSchema>;
export type EstadoBaseDatos = EstadoSalud['baseDatos'];
