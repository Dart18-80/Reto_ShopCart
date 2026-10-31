import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP, ejecutarSPMultiple } from '../../../src/shared/db/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';
import { crearVariante, type VarianteDePrueba } from '../datos-de-prueba.js';

interface Disponible {
  ExistenciaFisica: number;
  Reservado: number;
  Disponible: number;
}

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

function fijarExistencia(idVariante: number, existenciaFisica: number) {
  return ejecutarSP('SP_Pruebas_FijarExistencia', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
    ExistenciaFisica: { tipo: sql.Int, valor: existenciaFisica },
  });
}

function crearReserva(idVariante: number, cantidad: number, minutosParaVencer: number) {
  return ejecutarSP('SP_Pruebas_CrearReserva', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
    Cantidad: { tipo: sql.Int, valor: cantidad },
    MinutosParaVencer: { tipo: sql.Int, valor: minutosParaVencer },
  });
}

function registrarEntrada(variante: VarianteDePrueba, cantidad: number) {
  return ejecutarSP('SP_Pruebas_InsertarMovimientoKardex', {
    IDVariante: { tipo: sql.Int, valor: variante.IDVariante },
    IDTipoMovimiento: { tipo: sql.Int, valor: variante.IDTipoEntrada },
    Signo: { tipo: sql.SmallInt, valor: 1 },
    Cantidad: { tipo: sql.Int, valor: cantidad },
    ExistenciaAnterior: { tipo: sql.Int, valor: 0 },
    ExistenciaResultante: { tipo: sql.Int, valor: cantidad },
    IDUsuario: { tipo: sql.Int, valor: variante.IDUsuario },
  });
}

// Sin valores por defecto: si el SP dejara de devolver un conjunto, "conciliación vacía" pasaría sin probar nada.
async function leerInventario(idVariante: number) {
  const conjuntos = await ejecutarSPMultiple('SP_Pruebas_LeerInventario', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
  });
  const [disponible, conciliacion] = conjuntos;
  if (conjuntos.length !== 2 || disponible === undefined || conciliacion === undefined) {
    throw new Error(
      `SP_Pruebas_LeerInventario devolvió ${String(conjuntos.length)} conjuntos; se esperaban 2`,
    );
  }
  // El SP define la forma de la fila; Disponible la declara.
  return { disponible: disponible[0] as Disponible | undefined, conciliacion };
}

describe('FU_Inventario_Disponible (E1-H05, N-06)', () => {
  it('descuenta las reservas activas que aún no vencen', async () => {
    const { IDVariante } = await crearVariante();
    await fijarExistencia(IDVariante, 10);
    await crearReserva(IDVariante, 3, 15);

    const { disponible } = await leerInventario(IDVariante);

    expect(disponible).toEqual({ ExistenciaFisica: 10, Reservado: 3, Disponible: 7 });
  });

  it('ignora las reservas vencidas aunque sigan en estado Activa', async () => {
    const { IDVariante } = await crearVariante();
    await fijarExistencia(IDVariante, 10);
    await crearReserva(IDVariante, 4, -1);

    const { disponible } = await leerInventario(IDVariante);

    expect(disponible).toEqual({ ExistenciaFisica: 10, Reservado: 0, Disponible: 10 });
  });
});

describe('VW_Inventario_Conciliacion (E1-H05, N-07)', () => {
  it('no devuelve la variante cuando la existencia cuadra con el kardex', async () => {
    const variante = await crearVariante();
    await registrarEntrada(variante, 10);
    await fijarExistencia(variante.IDVariante, 10);

    const { conciliacion } = await leerInventario(variante.IDVariante);

    expect(conciliacion).toEqual([]);
  });

  it('devuelve la variante si se fuerza un descuadre entre la existencia y el kardex', async () => {
    const variante = await crearVariante();
    await registrarEntrada(variante, 10);
    await fijarExistencia(variante.IDVariante, 12);

    const { conciliacion } = await leerInventario(variante.IDVariante);

    expect(conciliacion).toEqual([
      {
        IDVariante: variante.IDVariante,
        ExistenciaFisica: 12,
        SumaKardex: 10,
        ExistenciaUltimoMovimiento: 10,
      },
    ]);
  });
});
