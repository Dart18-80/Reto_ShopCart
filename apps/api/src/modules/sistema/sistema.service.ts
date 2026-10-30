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
      const servidor = await repositorio.health();
      return {
        estado: 'ok',
        versionServidor: servidor.versionServidor,
        fechaHoraUtc: servidor.fechaHoraUtc.toISOString(),
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
      return {
        estado: calcularEstadoGeneral(baseDatos, estadoRedis),
        instancia,
        baseDatos,
        redis: estadoRedis,
      };
    },
  };
}

function calcularEstadoGeneral(
  baseDatos: EstadoBaseDatos,
  estadoRedis: EstadoSalud['redis'],
): EstadoSalud['estado'] {
  if (baseDatos.estado === 'caida') return 'caido';
  if (estadoRedis === 'degradado') return 'degradado';
  return 'ok';
}

export type SistemaService = ReturnType<typeof crearSistemaService>;
