// E9-H01: se carga con `node --import ./dist/telemetria.js dist/server.js`, antes que la API. Primero el hook de
// ESM y las instrumentaciones; después todo lo demás. Los imports son dinámicos porque uno estático se evaluaría
// antes que este código: telemetria.js no carga ninguna librería instrumentada, pero logger.js sí (pino).
import { register } from 'import-in-the-middle/register-hooks.mjs';
import type { Logger } from 'pino';

const { iniciarTelemetria, senalesOtlp, SIN_EXPORTAR, MODULOS_INSTRUMENTADOS } =
  await import('./shared/observability/telemetria.js');

// Hooks síncronos de Node 24 (module.registerHooks), solo para los paquetes instrumentados.
register({ include: MODULOS_INSTRUMENTADOS });

const instancia = process.env.INSTANCIA_ID ?? 'local';
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// pino se importa después de instrumentarlo; los exportadores escriben su estado cuando ya existe.
let logger: Logger | undefined = undefined;
const loggerDiferido: Pick<Logger, 'warn' | 'info'> = {
  warn: (...argumentos: Parameters<Logger['warn']>) => logger?.warn(...argumentos),
  info: (...argumentos: Parameters<Logger['info']>) => logger?.info(...argumentos),
};

iniciarTelemetria(instancia, endpoint ? senalesOtlp(endpoint, loggerDiferido) : SIN_EXPORTAR);

const { crearLogger } = await import('./shared/observability/logger.js');
logger = crearLogger({ instancia }).child({ modulo: 'telemetria' });
