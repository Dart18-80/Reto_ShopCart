import { resolve } from 'node:path';
import { z } from 'zod';
import { BASE_PRUEBAS, LOGIN_APP } from './conexion.ts';
import { ErrorMigracion } from './errores.ts';

// El nombre de la base se usa en la cadena de conexión y en CREATE DATABASE; se restringe a un identificador simple.
const NOMBRE_BASE = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;

const ARGUMENTO_PRUEBAS = '--pruebas';

// La misma marca que rechaza la API en producción (apps/api/src/shared/config, 01 §10).
const MARCA_EJEMPLO = 'EJEMPLO';
const CONTRASENAS = ['MSSQL_SA_PASSWORD', 'DB_CONTRASENA', 'DB_MIGRADOR_CONTRASENA'] as const;

// CREATE LOGIN no acepta parámetros: la contraseña se escapa con QUOTENAME, que devuelve NULL con más de 128 caracteres.
const contrasena = z.string().min(8).max(128);

const esquema = z.object({
  // Solo cambia la validación de las contraseñas, como en la API.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(1433),
  DB_NOMBRE: z
    .string()
    .regex(NOMBRE_BASE, 'solo letras, números y guion bajo, empezando con letra')
    .default('ShopCart'),
  DB_CONFIAR_CERTIFICADO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
  MSSQL_SA_PASSWORD: z.string().min(1),
  // Las mismas variables que usa la API: la contraseña del login de la app tiene una sola fuente.
  // El login se llama siempre shopcart_app porque V001 le asigna los permisos por nombre.
  DB_USUARIO: z.literal(LOGIN_APP, {
    error: `debe ser ${LOGIN_APP}: V001 le asigna los permisos por nombre`,
  }),
  DB_CONTRASENA: contrasena,
  DB_MIGRADOR_CONTRASENA: contrasena,
  DB_SCRIPTS_DIR: z
    .string()
    .min(1)
    .default(resolve(import.meta.dirname, '../..')),
});

export interface Configuracion {
  servidor: string;
  puerto: number;
  baseDatos: string;
  /** Solo con --pruebas: borra y vuelve a crear shopcart_test antes de migrar. */
  recrearBase: boolean;
  confiarCertificado: boolean;
  contrasenaAdmin: string;
  contrasenaApp: string;
  contrasenaMigrador: string;
  directorioScripts: string;
}

export function leerConfiguracion(
  entorno: NodeJS.ProcessEnv = process.env,
  argumentos: readonly string[] = process.argv.slice(2),
): Configuracion {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    throw new ErrorMigracion(`Configuración inválida:\n${z.prettifyError(resultado.error)}`);
  }
  const variables = resultado.data;
  if (variables.NODE_ENV === 'production') rechazarContrasenasDeEjemplo(variables);
  const modoPruebas = argumentos.includes(ARGUMENTO_PRUEBAS);
  return {
    servidor: variables.DB_HOST,
    puerto: variables.DB_PORT,
    baseDatos: modoPruebas ? BASE_PRUEBAS : variables.DB_NOMBRE,
    recrearBase: modoPruebas,
    confiarCertificado: variables.DB_CONFIAR_CERTIFICADO,
    contrasenaAdmin: variables.MSSQL_SA_PASSWORD,
    contrasenaApp: variables.DB_CONTRASENA,
    contrasenaMigrador: variables.DB_MIGRADOR_CONTRASENA,
    directorioScripts: variables.DB_SCRIPTS_DIR,
  };
}

// En producción el migrador no crea logins con las contraseñas de ejemplo de .env.example.
function rechazarContrasenasDeEjemplo(variables: z.infer<typeof esquema>): void {
  const conEjemplo = CONTRASENAS.filter((clave) => variables[clave].includes(MARCA_EJEMPLO));
  if (conEjemplo.length === 0) return;
  throw new ErrorMigracion(
    `En producción no se permiten las contraseñas de ejemplo (${MARCA_EJEMPLO}): ${conEjemplo.join(', ')}`,
  );
}
