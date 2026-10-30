import { z } from 'zod';

export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConfiguracion';
  }
}

const MARCA_EJEMPLO = 'EJEMPLO';
const SECRETOS = ['DB_CONTRASENA', 'REDIS_CONTRASENA'] as const;

const puerto = (porDefecto: number) =>
  z.coerce.number().int().min(1).max(65535).default(porDefecto);

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
  DB_CONFIAR_CERTIFICADO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: puerto(6379),
  REDIS_CONTRASENA: z.string().min(8),

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
}

export interface ConfiguracionRedis {
  servidor: string;
  puerto: number;
  contrasena: string;
}

export interface Configuracion {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  instancia: string;
  nivelLog: string;
  baseDatos: ConfiguracionBaseDatos;
  redis: ConfiguracionRedis;
  origenesCors: string[];
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
  const v = resultado.data;

  // §10: en producción no se arranca con los secretos de ejemplo de .env.example.
  if (v.NODE_ENV === 'production') {
    const conEjemplo = SECRETOS.filter((clave) => v[clave].includes(MARCA_EJEMPLO));
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
      puerto: v.DB_PORT,
      nombre: v.DB_NOMBRE,
      usuario: v.DB_USUARIO,
      contrasena: v.DB_CONTRASENA,
      confiarCertificado: v.DB_CONFIAR_CERTIFICADO,
    },
    redis: { servidor: v.REDIS_HOST, puerto: v.REDIS_PORT, contrasena: v.REDIS_CONTRASENA },
    origenesCors: v.CORS_ORIGINS,
  };
}
