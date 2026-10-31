import { pino } from 'pino';
import { leerConfiguracion } from './config.ts';
import { ErrorMigracion, mensajeDe } from './errores.ts';
import { migrar } from './migrador.ts';

const logger = pino({ name: 'db-migrator' });

try {
  await migrar(leerConfiguracion(), logger);
} catch (error) {
  if (error instanceof ErrorMigracion) {
    // La causa (el error de SQL) trae el número, la línea y los errores anteriores del lote.
    logger.error({ err: error.cause }, error.message);
  } else {
    logger.error({ err: error }, `Error inesperado del migrador: ${mensajeDe(error)}`);
  }
  process.exitCode = 1;
}
