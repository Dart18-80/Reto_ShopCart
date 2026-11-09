import { createRequire } from 'node:module';
import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { conexionMssql, opcionesDelPool } from '../../../../src/shared/db/pool.js';

// El TimeoutError del pool de mssql (tarn), la misma clase que lanza al no entregar una conexión a tiempo.
const desdeMssql = createRequire(createRequire(import.meta.url).resolve('mssql'));
const { TimeoutError } = desdeMssql('tarn') as { TimeoutError: new (mensaje?: string) => Error };

/** Un pool cuya ejecución falla con `error`, como cuando no hay conexión que entregar. */
const poolQueFalla = (error: Error) =>
  ({
    request: () => ({
      input: () => undefined,
      execute: () => Promise.reject(error),
    }),
  }) as unknown as sql.ConnectionPool;

const CONFIG = {
  servidor: 'sqlserver',
  puerto: 1433,
  nombre: 'ShopCart',
  usuario: 'shopcart_app',
  contrasena: 'x',
  confiarCertificado: true,
  tiempoMaximoConexionMs: 2000,
  tiempoMaximoConsultaMs: 15000,
};

describe('opcionesDelPool (A-26)', () => {
  it('mantiene dos conexiones abiertas por réplica, hasta diez, y espera una libre como mucho 5 s', () => {
    expect(opcionesDelPool(CONFIG).pool).toEqual({ min: 2, max: 10, acquireTimeoutMillis: 5000 });
  });

  it('los plazos salen de la configuración (DB_TIMEOUT_CONEXION_MS y DB_TIMEOUT_CONSULTA_MS)', () => {
    expect(opcionesDelPool(CONFIG)).toMatchObject({
      connectionTimeout: 2000,
      requestTimeout: 15000,
    });
  });
});

describe('conexionMssql (A-26)', () => {
  it('no obtener una conexión del pool a tiempo es un ConnectionError: ejecutarSP lo responde 503', async () => {
    const conexion = conexionMssql(poolQueFalla(new TimeoutError()));

    const error = await conexion.ejecutar('SP_Pruebas_Leer', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(sql.ConnectionError);
    expect(error).toMatchObject({ code: 'ETIMEOUT' });
  });

  it('cualquier otro error del driver pasa tal cual (un timeout de consulta sigue siendo un 500)', async () => {
    const lenta = new sql.RequestError(
      'Timeout: Request failed to complete in 15000ms',
      'ETIMEOUT',
    );
    const conexion = conexionMssql(poolQueFalla(lenta));

    await expect(conexion.ejecutar('SP_Pruebas_Leer', {})).rejects.toBe(lenta);
  });
});
