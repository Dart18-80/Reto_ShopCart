import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Las credenciales salen del mismo .env que usa el resto del proyecto.
const ARCHIVO_ENTORNO = resolve(import.meta.dirname, '../../../../.env');

if (existsSync(ARCHIVO_ENTORNO)) {
  process.loadEnvFile(ARCHIVO_ENTORNO);
}
