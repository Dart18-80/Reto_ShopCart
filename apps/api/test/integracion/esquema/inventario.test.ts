import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';
import { crearVariante, ERROR_DE_CONSTRAINT, type VarianteDePrueba } from '../datos-de-prueba.js';

interface Movimiento {
  idTipoMovimiento: number;
  signo: number;
  cantidad: number;
  existenciaAnterior: number;
  existenciaResultante: number;
}

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

function insertarMovimiento(variante: VarianteDePrueba, movimiento: Movimiento) {
  return ejecutarSP('SP_Pruebas_InsertarMovimientoKardex', {
    IDVariante: { tipo: sql.Int, valor: variante.IDVariante },
    IDTipoMovimiento: { tipo: sql.Int, valor: movimiento.idTipoMovimiento },
    Signo: { tipo: sql.SmallInt, valor: movimiento.signo },
    Cantidad: { tipo: sql.Int, valor: movimiento.cantidad },
    ExistenciaAnterior: { tipo: sql.Int, valor: movimiento.existenciaAnterior },
    ExistenciaResultante: { tipo: sql.Int, valor: movimiento.existenciaResultante },
    IDUsuario: { tipo: sql.Int, valor: variante.IDUsuario },
  });
}

describe('MovimientoKardex (E1-H02)', () => {
  it('acepta un movimiento coherente con su tipo y su saldo', async () => {
    const variante = await crearVariante();

    const filas = await insertarMovimiento(variante, {
      idTipoMovimiento: variante.IDTipoEntrada,
      signo: 1,
      cantidad: 10,
      existenciaAnterior: 0,
      existenciaResultante: 10,
    });

    expect(filas).toHaveLength(1);
  });

  it('rechaza un saldo que no cuadra: ExistenciaResultante ≠ Anterior + Signo × Cantidad', async () => {
    const variante = await crearVariante();

    const intento = insertarMovimiento(variante, {
      idTipoMovimiento: variante.IDTipoEntrada,
      signo: 1,
      cantidad: 10,
      existenciaAnterior: 0,
      existenciaResultante: 99,
    });

    await expect(intento).rejects.toMatchObject({
      number: ERROR_DE_CONSTRAINT,
      message: expect.stringContaining('CK_MovimientoKardex_ExistenciaResultante') as unknown,
    });
  });

  it('rechaza un signo que contradice el tipo, por la FK compuesta (IDTipoMovimiento, Signo)', async () => {
    const variante = await crearVariante();

    const intento = insertarMovimiento(variante, {
      idTipoMovimiento: variante.IDTipoEntrada,
      signo: -1,
      cantidad: 1,
      existenciaAnterior: 5,
      existenciaResultante: 4,
    });

    await expect(intento).rejects.toMatchObject({
      number: ERROR_DE_CONSTRAINT,
      message: expect.stringContaining('FK_MovimientoKardex_TipoMovimiento') as unknown,
    });
  });

  it('rechaza un saldo negativo', async () => {
    const variante = await crearVariante();

    const intento = insertarMovimiento(variante, {
      idTipoMovimiento: variante.IDTipoSalida,
      signo: -1,
      cantidad: 3,
      existenciaAnterior: 2,
      existenciaResultante: -1,
    });

    await expect(intento).rejects.toMatchObject({ number: ERROR_DE_CONSTRAINT });
  });
});
