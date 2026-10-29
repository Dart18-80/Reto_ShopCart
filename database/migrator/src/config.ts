import { resolve } from 'node:path';
import { z } from 'zod';
import { ErrorMigracion } from './errores.ts';

// El nombre de la base se usa en la cadena de conexión y en CREATE DATABASE; se restringe a un identificador simple.
const NOMBRE_BASE = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;

// CREATE LOGIN no acepta parámetros: la contraseña se escapa con QUOTENAME, que devuelve NULL con más de 128 caracteres.
const contrasena = z.string().min(8).max(128);

const esquema = z.object({
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PUERTO: z.coerce.number().int().positive().default(1433),
  DB_NOMBRE: z
    .string()
    .regex(NOMBRE_BASE, 'solo letras, números y guion bajo, empezando con letra')
    .default('ShopCart'),
  DB_CONFIAR_CERTIFICADO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
  MSSQL_SA_PASSWORD: z.string().min(1),
  DB_APP_CONTRASENA: contrasena,
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
  confiarCertificado: boolean;
  contrasenaAdmin: string;
  contrasenaApp: string;
  contrasenaMigrador: string;
  directorioScripts: string;
}

export function leerConfiguracion(entorno: NodeJS.ProcessEnv = process.env): Configuracion {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    throw new ErrorMigracion(`Configuración inválida:\n${z.prettifyError(resultado.error)}`);
  }
  const variables = resultado.data;
  return {
    servidor: variables.DB_HOST,
    puerto: variables.DB_PUERTO,
    baseDatos: variables.DB_NOMBRE,
    confiarCertificado: variables.DB_CONFIAR_CERTIFICADO,
    contrasenaAdmin: variables.MSSQL_SA_PASSWORD,
    contrasenaApp: variables.DB_APP_CONTRASENA,
    contrasenaMigrador: variables.DB_MIGRADOR_CONTRASENA,
    directorioScripts: variables.DB_SCRIPTS_DIR,
  };
}
