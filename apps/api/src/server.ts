import type { Server } from 'node:http';
import { crearApp } from './app.js';
import { crearClienteRedis, crearVerificadorRedis } from './shared/adapters/redis.js';
import { cargarConfiguracion, ErrorConfiguracion } from './shared/config/index.js';
import { conectarPool, conexionMssql, configurarBaseDatos } from './shared/db/index.js';
import { crearLogger } from './shared/observability/index.js';

const ESPERA_APAGADO_MS = 10_000;

async function iniciar(): Promise<void> {
  const config = cargarConfiguracion(process.env);
  const logger = crearLogger({ nivel: config.nivelLog, instancia: config.instancia });

  const pool = await conectarPool(config.baseDatos);
  configurarBaseDatos(conexionMssql(pool), logger);

  const redis = crearClienteRedis(config.redis);
  redis.on('error', (error: Error) => {
    logger.warn({ err: error }, 'Redis no responde: la API sigue en modo degradado');
  });
  // Si Redis no está al arrancar, la API arranca igual (RNF-2); el cliente reintenta en segundo plano.
  redis.connect().catch(() => undefined);

  const app = crearApp({
    logger,
    instancia: config.instancia,
    origenesCors: config.origenesCors,
    verificadorRedis: crearVerificadorRedis(redis),
  });

  const servidor: Server = app.listen(config.puerto, () => {
    logger.info({ puerto: config.puerto, entorno: config.entorno }, 'API escuchando');
  });

  // Apagado ordenado: deja de aceptar conexiones, termina las peticiones en curso y cierra recursos.
  const apagar = (senal: string): void => {
    logger.info({ senal }, 'Apagando la API');
    const forzar = setTimeout(() => {
      logger.error('El apagado tardó demasiado; se fuerza la salida');
      process.exit(1);
    }, ESPERA_APAGADO_MS);
    forzar.unref();

    servidor.close(() => {
      void Promise.allSettled([pool.close(), redis.quit()]).then(() => {
        logger.info('API detenida');
        process.exit(0);
      });
    });
  };
  process.once('SIGTERM', apagar);
  process.once('SIGINT', apagar);
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
