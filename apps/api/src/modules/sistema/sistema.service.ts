import type { Logger } from 'pino';
import type { SistemaRepository } from './sistema.repository.js';
import type {
  EstadoBaseDatos,
  EstadoSalud,
  ServidorBaseDatos,
  VerificadorRedis,
} from './sistema.types.js';

interface Dependencias {
  repositorio: SistemaRepository;
  redis: VerificadorRedis;
  instancia: string;
  logger: Logger;
}

export interface SistemaService {
  salud(): Promise<EstadoSalud>;
}

export function crearSistemaService({
  repositorio,
  redis,
  instancia,
  logger,
}: Dependencias): SistemaService {
  // Solo la llamada a la base cuenta como "caída": un bug después de responder llega como 500.
  async function estadoBaseDatos(): Promise<EstadoBaseDatos> {
    let servidor: ServidorBaseDatos;
    try {
      servidor = await repositorio.health();
    } catch (error) {
      logger.error({ err: error }, 'La base de datos no responde');
      return 'caida';
    }
    // En debug: el healthcheck de Docker lo llama cada pocos segundos en cada réplica.
    logger.debug(
      {
        versionServidor: servidor.versionServidor,
        fechaHoraUtc: servidor.fechaHoraUtc.toISOString(),
      },
      'SQL Server responde',
    );
    return 'ok';
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
  if (baseDatos === 'caida') return 'caido';
  if (estadoRedis === 'degradado') return 'degradado';
  return 'ok';
}
