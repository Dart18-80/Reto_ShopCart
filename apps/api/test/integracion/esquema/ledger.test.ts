import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';

// Error del motor ante UPDATE o DELETE sobre una tabla ledger append-only (E1-H01).
const ERROR_LEDGER_SOLO_INSERCION = 37359;

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

describe('Tablas ledger (E1-H04, M-01)', () => {
  it.each([
    ['Bitacora', 'Modificar'],
    ['Bitacora', 'Eliminar'],
    ['MovimientoKardex', 'Modificar'],
    ['MovimientoKardex', 'Eliminar'],
    ['HistorialEstadoPedido', 'Modificar'],
    ['HistorialEstadoPedido', 'Eliminar'],
  ])('%s rechaza %s', async (tabla, operacion) => {
    const intento = ejecutarSP('SP_Pruebas_ModificarLedger', {
      Tabla: { tipo: sql.VarChar(30), valor: tabla },
      Operacion: { tipo: sql.VarChar(10), valor: operacion },
    });

    await expect(intento).rejects.toMatchObject({ number: ERROR_LEDGER_SOLO_INSERCION });
  });
});
