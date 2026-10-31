import type { Logger } from 'pino';
import { registrarApagadoOrdenado } from './apagado.js';
import { crearApp } from './app.js';
import {
  crearClienteRedis,
  crearVerificadorRedis,
  registrarCambiosDeEstado,
} from './shared/adapters/redis.js';
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
  // mssql reemite en el pool los errores de conexión; sin listener, EventEmitter los lanza y tumban la réplica.
  pool.on('error', (error: unknown) => {
    logger.error({ err: error }, 'Error del pool de SQL Server');
  });
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

  // El callback de listen solo cubre el arranque; un error posterior (por ejemplo, EMFILE) se perdería.
  servidor.on('error', (error) => {
    logger.error({ err: error }, 'Error del servidor HTTP');
  });

  registrarApagadoOrdenado({
    proceso: process,
    servidor,
    recursos: [() => pool.close(), () => redis.quit()],
    logger,
    salir: (codigo) => process.exit(codigo),
    esperaMaximaMs: ESPERA_APAGADO_MS,
  });
}

// RNF-2: si Redis no está al arrancar, la API arranca igual y el cliente reintenta en segundo plano.
function conectarRedis(config: ConfiguracionRedis, logger: Logger): ClienteRedis {
  const redis = crearClienteRedis(config);
  registrarCambiosDeEstado(redis, logger);
  // No se traga: el mismo fallo se emite como evento 'error' y lo registra registrarCambiosDeEstado.
  redis.connect().catch(() => undefined);
  return redis;
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
