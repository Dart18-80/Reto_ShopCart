import type { Server } from 'node:http';
import type sql from 'mssql';
import type { Logger } from 'pino';
import { crearApp } from './app.js';
import { crearClienteRedis, crearVerificadorRedis } from './shared/adapters/redis.js';
import {
  cargarConfiguracion,
  ErrorConfiguracion,
  type ConfiguracionRedis,
} from './shared/config/index.js';
import { conectarPool, conexionMssql, configurarBaseDatos } from './shared/db/index.js';
import { crearLogger } from './shared/observability/index.js';

const ESPERA_APAGADO_MS = 10_000;

type ClienteRedis = ReturnType<typeof crearClienteRedis>;

async function iniciar(): Promise<void> {
  const config = cargarConfiguracion(process.env);
  const logger = crearLogger({ nivel: config.nivelLog, instancia: config.instancia });

  const pool = await conectarPool(config.baseDatos);
  configurarBaseDatos(conexionMssql(pool), logger);
  const redis = conectarRedis(config.redis, logger);

  const app = crearApp({
    logger,
    instancia: config.instancia,
    origenesCors: config.origenesCors,
    verificadorRedis: crearVerificadorRedis(redis),
  });

  // Express 5 también llama a este callback si listen falla (por ejemplo, puerto ocupado).
  const servidor = app.listen(config.puerto, (error?: Error) => {
    if (error !== undefined) {
      logger.fatal({ err: error, puerto: config.puerto }, 'La API no pudo escuchar en el puerto');
      process.exit(1);
    }
    logger.info({ puerto: config.puerto, entorno: config.entorno }, 'API escuchando');
  });

  registrarApagadoOrdenado({ servidor, pool, redis, logger });
}

// RNF-2: si Redis no está al arrancar, la API arranca igual y el cliente reintenta en segundo plano.
function conectarRedis(config: ConfiguracionRedis, logger: Logger): ClienteRedis {
  const redis = crearClienteRedis(config);
  redis.on('error', (error: Error) => {
    logger.warn({ err: error }, 'Redis no responde: la API sigue en modo degradado');
  });
  // No se traga: el mismo fallo se emite como evento 'error' y lo registra el handler de arriba.
  redis.connect().catch(() => undefined);
  return redis;
}

interface RecursosAbiertos {
  servidor: Server;
  pool: sql.ConnectionPool;
  redis: ClienteRedis;
  logger: Logger;
}

function registrarApagadoOrdenado({ servidor, pool, redis, logger }: RecursosAbiertos): void {
  // servidor.close deja de aceptar conexiones pero espera a que terminen las peticiones en curso.
  const apagarOrdenadamente = (senal: string): void => {
    logger.info({ senal }, 'Apagando la API');
    const forzarSalida = setTimeout(() => {
      logger.error('El apagado tardó demasiado; se fuerza la salida');
      process.exit(1);
    }, ESPERA_APAGADO_MS);
    forzarSalida.unref();

    servidor.close(() => {
      void Promise.allSettled([pool.close(), redis.quit()]).then((cierres) => {
        for (const cierre of cierres) {
          if (cierre.status === 'rejected') {
            logger.warn({ err: cierre.reason }, 'Un recurso no se cerró limpiamente');
          }
        }
        logger.info('API detenida');
        process.exit(0);
      });
    });
  };
  process.once('SIGTERM', apagarOrdenadamente);
  process.once('SIGINT', apagarOrdenadamente);
}

iniciar().catch((error: unknown) => {
  const logger = crearLogger();
  if (error instanceof ErrorConfiguracion) {
    logger.fatal(error.message);
  } else {
    logger.fatal({ err: error }, 'La API no pudo arrancar');
  }
  process.exit(1);
});
