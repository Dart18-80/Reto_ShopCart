import { pino, type DestinationStream, type Logger } from 'pino';
import { obtenerContexto } from '../http/contexto.js';

const CAMPOS_SENSIBLES = [
  'contrasena',
  'contrasenaActual',
  'contrasenaNueva',
  'numeroTarjeta',
  'cvv',
  'token',
  'refreshToken',
  'authorization',
  'cookie',
  'set-cookie',
];

// pino solo acepta un comodín por nivel: se cubren el campo directo y hasta dos niveles de anidamiento.
const RUTAS_REDACTADAS = CAMPOS_SENSIBLES.flatMap((campo) => [
  `["${campo}"]`,
  `*["${campo}"]`,
  `*.*["${campo}"]`,
]);

export interface OpcionesLogger {
  nivel?: string;
  instancia?: string;
  destino?: DestinationStream;
}

/** Logger JSON con el requestId y el usuario de la petición en curso en cada línea (RNF-4). */
export function crearLogger({ nivel = 'info', instancia, destino }: OpcionesLogger = {}): Logger {
  return pino(
    {
      level: nivel,
      base: { instancia },
      redact: { paths: RUTAS_REDACTADAS, censor: '[REDACTADO]' },
      mixin() {
        const contexto = obtenerContexto();
        return contexto === undefined
          ? {}
          : { requestId: contexto.requestId, idUsuario: contexto.idUsuario };
      },
    },
    destino,
  );
}
