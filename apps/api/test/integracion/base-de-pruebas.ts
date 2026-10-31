import type sql from 'mssql';
import { pino, type Logger } from 'pino';
import { afterAll, beforeAll } from 'vitest';
import { cargarConfiguracion } from '../../src/shared/config/index.js';
import { conectarPool, conexionMssql, configurarBaseDatos } from '../../src/shared/db/index.js';

export const BASE_DE_PRUEBAS = 'shopcart_test';

/** Conecta ejecutarSP a shopcart_test con el login de la API (shopcart_app). */
export async function conectarBaseDePruebas(
  logger: Logger = pino({ level: 'silent' }),
): Promise<sql.ConnectionPool> {
  const config = cargarConfiguracion(process.env);
  if (config.baseDatos.nombre !== BASE_DE_PRUEBAS) {
    throw new Error(`Las pruebas de integración solo corren contra ${BASE_DE_PRUEBAS}.`);
  }
  const pool = await conectarPool(config.baseDatos);
  configurarBaseDatos(conexionMssql(pool), logger);
  return pool;
}

/**
 * Conecta ejecutarSP a shopcart_test antes de las pruebas del archivo y cierra el pool al terminar.
 * El logger permite verificar lo que ejecutarSP registra (por ejemplo, reintentos por deadlock).
 */
export function usarBaseDePruebas(logger?: Logger): void {
  let pool: sql.ConnectionPool | undefined;

  beforeAll(async () => {
    pool = await conectarBaseDePruebas(logger);
  });

  afterAll(async () => {
    await pool?.close();
  });
}
