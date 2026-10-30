import sql from 'mssql';
import type { Configuracion } from './config.ts';

export const LOGIN_ADMIN = 'sa';
export const LOGIN_APP = 'shopcart_app';
export const LOGIN_MIGRADOR = 'shopcart_migrator';

// Nombre fijo: database/test/ y la recreación nunca pueden alcanzar otra base por configuración.
export const BASE_PRUEBAS = 'shopcart_test';

// Los seeds y la carga pesada pueden tardar más que el timeout por defecto de 15 s.
const TIEMPO_MAXIMO_MS = 5 * 60 * 1000;

interface Credenciales {
  usuario: string;
  contrasena: string;
}

export function conectar(
  config: Configuracion,
  credenciales: Credenciales,
  baseDatos: string,
): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    server: config.servidor,
    port: config.puerto,
    database: baseDatos,
    user: credenciales.usuario,
    password: credenciales.contrasena,
    requestTimeout: TIEMPO_MAXIMO_MS,
    // min: 1 impide que el pool cierre la conexión ociosa a los 30 s: la que guarda el sp_getapplock de
    // sesión no hace nada mientras dura la migración, y al cerrarse soltaría el bloqueo.
    pool: { min: 1, max: 1 },
    options: { encrypt: true, trustServerCertificate: config.confiarCertificado },
  }).connect();
}
