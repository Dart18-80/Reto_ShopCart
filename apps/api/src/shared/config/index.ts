import type { Level } from 'pino';
import { z } from 'zod';

export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConfiguracion';
  }
}

const MARCA_EJEMPLO = 'EJEMPLO';
const SECRETOS = ['DB_CONTRASENA', 'REDIS_CONTRASENA', 'JWT_SECRETO'] as const;
// HS256 (A-07): un secreto de al menos 256 bits.
const LARGO_MINIMO_SECRETO_JWT = 32;
// Redis trae 16 bases lógicas (0 a 15) por defecto.
const ULTIMA_BASE_REDIS = 15;

const puerto = (porDefecto: number) =>
  z.coerce.number().int().min(1).max(65535).default(porDefecto);

const milisegundos = (porDefecto: number) => z.coerce.number().int().positive().default(porDefecto);

// 2 s para conectar: dentro de la subred una conexión tarda milisegundos, y el health con la base
// caída debe responder antes que el timeout de 3 s del healthcheck de Docker. 15 s por consulta: el
// valor por defecto de mssql, ahora explícito.
const TIMEOUT_CONEXION_MS = 2000;
const TIMEOUT_CONSULTA_MS = 15000;

// Cada valor tiene una sola fuente en .env; en Compose las réplicas solo reemplazan DB_HOST y REDIS_HOST.
const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: puerto(3000),
  INSTANCIA_ID: z.string().min(1).default('local'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: puerto(1433),
  DB_NOMBRE: z.string().min(1).default('ShopCart'),
  DB_USUARIO: z.string().min(1),
  DB_CONTRASENA: z.string().min(8),
  DB_TIMEOUT_CONEXION_MS: milisegundos(TIMEOUT_CONEXION_MS),
  DB_TIMEOUT_CONSULTA_MS: milisegundos(TIMEOUT_CONSULTA_MS),
  DB_CONFIAR_CERTIFICADO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: puerto(6379),
  REDIS_CONTRASENA: z.string().min(8),
  // Las pruebas de integración usan otra base lógica: sus claves no tocan las del entorno levantado.
  REDIS_BASE_DATOS: z.coerce.number().int().min(0).max(ULTIMA_BASE_REDIS).default(0),

  JWT_SECRETO: z.string().min(LARGO_MINIMO_SECRETO_JWT),

  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((lista) =>
      lista
        .split(',')
        .map((origen) => origen.trim())
        .filter((origen) => origen.length > 0),
    )
    .pipe(z.array(z.url()).min(1)),
});

export interface ConfiguracionBaseDatos {
  servidor: string;
  puerto: number;
  nombre: string;
  usuario: string;
  contrasena: string;
  confiarCertificado: boolean;
  tiempoMaximoConexionMs: number;
  tiempoMaximoConsultaMs: number;
}

export interface ConfiguracionRedis {
  servidor: string;
  puerto: number;
  contrasena: string;
  baseDatos: number;
}

export interface Configuracion {
  entorno: z.infer<typeof esquema>['NODE_ENV'];
  puerto: number;
  instancia: string;
  nivelLog: Level;
  baseDatos: ConfiguracionBaseDatos;
  redis: ConfiguracionRedis;
  origenesCors: string[];
  secretoJwt: string;
}

/**
 * Valida las variables de entorno al arrancar: si algo falta, el proceso no inicia.
 * El entorno solo cambia la validación de secretos: nunca relaja otra medida de seguridad.
 */
export function cargarConfiguracion(entorno: NodeJS.ProcessEnv): Configuracion {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    throw new ErrorConfiguracion(`Configuración inválida:\n${z.prettifyError(resultado.error)}`);
  }
  const variables = resultado.data;
  if (variables.NODE_ENV === 'production') rechazarSecretosDeEjemplo(variables);

  return {
    entorno: variables.NODE_ENV,
    puerto: variables.PUERTO,
    instancia: variables.INSTANCIA_ID,
    nivelLog: variables.LOG_LEVEL,
    baseDatos: {
      servidor: variables.DB_HOST,
      puerto: variables.DB_PORT,
      nombre: variables.DB_NOMBRE,
      usuario: variables.DB_USUARIO,
      contrasena: variables.DB_CONTRASENA,
      confiarCertificado: variables.DB_CONFIAR_CERTIFICADO,
      tiempoMaximoConexionMs: variables.DB_TIMEOUT_CONEXION_MS,
      tiempoMaximoConsultaMs: variables.DB_TIMEOUT_CONSULTA_MS,
    },
    redis: {
      servidor: variables.REDIS_HOST,
      puerto: variables.REDIS_PORT,
      contrasena: variables.REDIS_CONTRASENA,
      baseDatos: variables.REDIS_BASE_DATOS,
    },
    origenesCors: variables.CORS_ORIGINS,
    secretoJwt: variables.JWT_SECRETO,
  };
}

// §10: en producción no se arranca con los secretos de ejemplo de .env.example.
function rechazarSecretosDeEjemplo(variables: z.infer<typeof esquema>): void {
  const conEjemplo = SECRETOS.filter((clave) => variables[clave].includes(MARCA_EJEMPLO));
  if (conEjemplo.length === 0) return;
  throw new ErrorConfiguracion(
    `En producción no se permiten los secretos de ejemplo (${MARCA_EJEMPLO}): ${conEjemplo.join(', ')}`,
  );
}
