import { z } from 'zod';

export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConfiguracion';
  }
}

const MARCA_EJEMPLO = 'EJEMPLO';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().positive().default(3000),
  INSTANCIA_ID: z.string().min(1).default('local'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PUERTO: z.coerce.number().int().positive().default(1433),
  DB_NOMBRE: z.string().min(1).default('ShopCart'),
  DB_APP_CONTRASENA: z.string().min(8),
  DB_CONFIAR_CERTIFICADO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),

  REDIS_URL: z
    .url({ protocol: /^rediss?$/, error: 'debe ser una URL redis:// con la contraseña' })
    .refine((url) => new URL(url).password.length > 0, 'debe incluir la contraseña (requirepass)'),

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
  contrasena: string;
  confiarCertificado: boolean;
}

export interface Configuracion {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  instancia: string;
  nivelLog: string;
  baseDatos: ConfiguracionBaseDatos;
  redisUrl: string;
  origenesCors: string[];
}

/** Valida las variables de entorno al arrancar: si algo falta, el proceso no inicia. */
export function cargarConfiguracion(entorno: NodeJS.ProcessEnv): Configuracion {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    throw new ErrorConfiguracion(`Configuración inválida:\n${z.prettifyError(resultado.error)}`);
  }
  const v = resultado.data;

  // §10: en producción no se arranca con los secretos de ejemplo de .env.example.
  if (v.NODE_ENV === 'production') {
    const conEjemplo = (['DB_APP_CONTRASENA', 'REDIS_URL'] as const).filter((clave) =>
      v[clave].includes(MARCA_EJEMPLO),
    );
    if (conEjemplo.length > 0) {
      throw new ErrorConfiguracion(
        `En producción no se permiten los secretos de ejemplo (${MARCA_EJEMPLO}): ${conEjemplo.join(', ')}`,
      );
    }
  }

  return {
    entorno: v.NODE_ENV,
    puerto: v.PUERTO,
    instancia: v.INSTANCIA_ID,
    nivelLog: v.LOG_LEVEL,
    baseDatos: {
      servidor: v.DB_HOST,
      puerto: v.DB_PUERTO,
      nombre: v.DB_NOMBRE,
      contrasena: v.DB_APP_CONTRASENA,
      confiarCertificado: v.DB_CONFIAR_CERTIFICADO,
    },
    redisUrl: v.REDIS_URL,
    origenesCors: v.CORS_ORIGINS,
  };
}
