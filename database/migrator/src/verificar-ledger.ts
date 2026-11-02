import { resolve } from 'node:path';
import { pino } from 'pino';
import { leerConfiguracion } from './config.ts';
import { mensajeDe } from './errores.ts';
import { verificarLedger } from './ledger.ts';

// `pnpm ledger:verificar` (M-01). Los digests se guardan fuera de la base, en LEDGER_DIGESTS_DIR o en .ledger/
// de la raíz del repositorio (ignorada por git).
const logger = pino({ name: 'ledger' });
const DIRECTORIO_POR_DEFECTO = resolve(import.meta.dirname, '../../../.ledger');

try {
  await verificarLedger(
    leerConfiguracion(),
    process.env.LEDGER_DIGESTS_DIR ?? DIRECTORIO_POR_DEFECTO,
    logger,
  );
} catch (error) {
  logger.error({ err: error }, mensajeDe(error));
  process.exitCode = 1;
}
