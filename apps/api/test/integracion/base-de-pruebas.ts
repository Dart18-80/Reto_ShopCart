import type sql from 'mssql';
import { pino } from 'pino';
import { afterAll, beforeAll } from 'vitest';
import { cargarConfiguracion } from '../../src/shared/config/index.js';
import { conectarPool, conexionMssql, configurarBaseDatos } from '../../src/shared/db/index.js';

export const BASE_DE_PRUEBAS = 'shopcart_test';

/** Conecta ejecutarSP a shopcart_test con el login de la API (shopcart_app). */
export async function conectarBaseDePruebas(): Promise<sql.ConnectionPool> {
  const config = cargarConfiguracion(process.env);
  if (config.baseDatos.nombre !== BASE_DE_PRUEBAS) {
    throw new Error(`Las pruebas de integración solo corren contra ${BASE_DE_PRUEBAS}.`);
  }
  const pool = await conectarPool(config.baseDatos);
  configurarBaseDatos(conexionMssql(pool), pino({ level: 'silent' }));
  return pool;
}

/** Conecta ejecutarSP a shopcart_test antes de las pruebas del archivo y cierra el pool al terminar. */
export function usarBaseDePruebas(): void {
  let pool: sql.ConnectionPool | undefined;

  beforeAll(async () => {
    pool = await conectarBaseDePruebas();
  });

  afterAll(async () => {
    await pool?.close();
  });
}
