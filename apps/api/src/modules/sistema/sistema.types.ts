/** Puerto hacia Redis para el health; el adaptador vive en shared/adapters/redis.ts. */
export interface VerificadorRedis {
  ping(): Promise<boolean>;
}

export interface InfoBaseDatos {
  versionServidor: string;
  fechaHoraUtc: Date;
}

export type EstadoBaseDatos =
  { estado: 'ok'; versionServidor: string; fechaHoraUtc: string } | { estado: 'caida' };

export interface EstadoSalud {
  /** ok: todo responde · degradado: Redis caído (se sigue vendiendo, RNF-2) · caido: sin base. */
  estado: 'ok' | 'degradado' | 'caido';
  instancia: string;
  baseDatos: EstadoBaseDatos;
  redis: 'ok' | 'degradado';
}
