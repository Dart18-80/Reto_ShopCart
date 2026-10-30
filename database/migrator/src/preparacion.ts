import sql from 'mssql';
import type { Logger } from 'pino';
import type { Configuracion } from './config.ts';
import { conectar, LOGIN_ADMIN } from './conexion.ts';
import { leerConsulta } from './consultas.ts';

/**
 * Pasos que exigen permisos de administrador y no pueden vivir en un V###: crear la base, activar RCSI,
 * crear los logins y sus usuarios, y la tabla HistorialMigracion que el resto del proceso necesita.
 */
export async function prepararServidor(config: Configuracion, logger: Logger): Promise<void> {
  const admin = { usuario: LOGIN_ADMIN, contrasena: config.contrasenaAdmin };

  const master = await conectar(config, admin, 'master');
  try {
    if (config.recrearBase) {
      await master
        .request()
        .input('Base', sql.NVarChar(128), config.baseDatos)
        .query(await leerConsulta('recrear-base'));
      logger.info({ baseDatos: config.baseDatos }, 'Base de pruebas borrada para recrearla');
    }
    await master
      .request()
      .input('Base', sql.NVarChar(128), config.baseDatos)
      .input('ContrasenaApp', sql.NVarChar(128), config.contrasenaApp)
      .input('ContrasenaMigrador', sql.NVarChar(128), config.contrasenaMigrador)
      .query(await leerConsulta('preparar-servidor'));
  } finally {
    await master.close();
  }

  const base = await conectar(config, admin, config.baseDatos);
  try {
    await base.request().batch(await leerConsulta('preparar-base'));
  } finally {
    await base.close();
  }

  logger.info({ baseDatos: config.baseDatos }, 'Base, RCSI, logins y HistorialMigracion listos');
}
