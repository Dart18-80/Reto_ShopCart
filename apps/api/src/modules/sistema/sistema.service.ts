import type { Logger } from 'pino';
import type { SistemaRepository } from './sistema.repository.js';
import type { EstadoBaseDatos, EstadoSalud, VerificadorRedis } from './sistema.types.js';

interface Dependencias {
  repositorio: SistemaRepository;
  redis: VerificadorRedis;
  instancia: string;
  logger: Logger;
}

export function crearSistemaService({ repositorio, redis, instancia, logger }: Dependencias) {
  async function estadoBaseDatos(): Promise<EstadoBaseDatos> {
    try {
      const info = await repositorio.health();
      return {
        estado: 'ok',
        versionServidor: info.versionServidor,
        fechaHoraUtc: info.fechaHoraUtc.toISOString(),
      };
    } catch (error) {
      logger.error({ err: error }, 'La base de datos no responde');
      return { estado: 'caida' };
    }
  }

  return {
    async salud(): Promise<EstadoSalud> {
      const [baseDatos, redisResponde] = await Promise.all([estadoBaseDatos(), redis.ping()]);
      const estadoRedis = redisResponde ? 'ok' : 'degradado';
      const estado =
        baseDatos.estado === 'caida' ? 'caido' : estadoRedis === 'ok' ? 'ok' : 'degradado';
      return { estado, instancia, baseDatos, redis: estadoRedis };
    },
  };
}

export type SistemaService = ReturnType<typeof crearSistemaService>;
