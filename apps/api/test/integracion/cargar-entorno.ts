import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Las credenciales de SQL Server salen del mismo .env que usa el resto del proyecto. loadEnvFile no
// sobrescribe lo que ya existe, así que DB_NOMBRE=shopcart_test (vitest.integracion.config.ts) se respeta.
const ARCHIVO_ENTORNO = resolve(import.meta.dirname, '../../../../.env');

if (existsSync(ARCHIVO_ENTORNO)) {
  process.loadEnvFile(ARCHIVO_ENTORNO);
}
