import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoActor, crearVariante, unaFila } from '../datos-de-prueba.js';

const REQUEST_ID = '8f1c2e9a-0000-4000-8000-000000000005';

interface Movimiento {
  CodigoTipo: string;
  Signo: number;
  Cantidad: number;
  ExistenciaAnterior: number;
  ExistenciaResultante: number;
  IDUsuario: number;
  RequestId: string;
  ExistenciaFisica: number;
}

interface EstadoKardex {
  ExistenciaFisica: number;
  Movimientos: number;
}

usarBaseDePruebas();

function registrar(idVariante: number, codigoTipo: string, cantidad: number) {
  return unaFila<Movimiento>('SP_Pruebas_RegistrarMovimiento', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
    CodigoTipo: { tipo: sql.VarChar(30), valor: codigoTipo },
    Cantidad: { tipo: sql.Int, valor: cantidad },
  });
}

function leerKardex(idVariante: number) {
  return unaFila<EstadoKardex>('SP_Pruebas_LeerKardex', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
  });
}

describe('SP_Inventario_RegistrarMovimiento (N-07)', () => {
  it('calcula el saldo anterior y el resultante y deja la existencia igual al último saldo', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    const entrada = await comoActor(IDUsuario, 'Operador', () =>
      registrar(IDVariante, 'EntradaCompra', 10),
    );
    const salida = await comoActor(IDUsuario, 'Operador', () =>
      registrar(IDVariante, 'SalidaVenta', 3),
    );

    expect(entrada).toMatchObject({
      ExistenciaAnterior: 0,
      ExistenciaResultante: 10,
      ExistenciaFisica: 10,
    });
    expect(salida).toMatchObject({
      ExistenciaAnterior: 10,
      ExistenciaResultante: 7,
      ExistenciaFisica: 7,
    });
  });

  it('registra el usuario y el RequestId del contexto de la petición', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    const movimiento = await comoActor(
      IDUsuario,
      'Operador',
      () => registrar(IDVariante, 'EntradaCompra', 4),
      REQUEST_ID,
    );

    expect(movimiento).toMatchObject({ IDUsuario, RequestId: REQUEST_ID.toUpperCase() });
  });

  it.each([
    ['EntradaCompra', 1],
    ['SalidaVenta', -1],
    ['AjustePositivo', 1],
    ['AjusteNegativo', -1],
    ['ReingresoCancelacion', 1],
    ['ReingresoDevolucion', 1],
  ])('toma el signo del tipo de movimiento: %s → %i', async (codigoTipo, signo) => {
    const { IDVariante, IDUsuario } = await crearVariante();
    await comoActor(IDUsuario, 'Operador', () => registrar(IDVariante, 'EntradaCompra', 20));

    const movimiento = await comoActor(IDUsuario, 'Operador', () =>
      registrar(IDVariante, codigoTipo, 5),
    );

    expect(movimiento).toMatchObject({
      CodigoTipo: codigoTipo,
      Signo: signo,
      Cantidad: 5,
      ExistenciaResultante: 20 + signo * 5,
    });
  });

  it('rechaza con 50005 INVARIANTE_INTERNA si el llamador no abrió una transacción, sin escribir nada', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    const intento = comoActor(IDUsuario, 'Operador', () =>
      ejecutarSP('SP_Pruebas_RegistrarMovimientoSinTransaccion', {
        IDVariante: { tipo: sql.Int, valor: IDVariante },
      }),
    );

    await expect(intento).rejects.toMatchObject({ codigo: 'INVARIANTE_INTERNA' });
    expect(await leerKardex(IDVariante)).toEqual({ ExistenciaFisica: 0, Movimientos: 0 });
  });

  it('nunca deja la existencia negativa: rechaza con 50301 y no cambia nada', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();
    await comoActor(IDUsuario, 'Operador', () => registrar(IDVariante, 'EntradaCompra', 2));

    const intento = comoActor(IDUsuario, 'Operador', () => registrar(IDVariante, 'SalidaVenta', 3));

    await expect(intento).rejects.toMatchObject({ codigo: 'STOCK_INSUFICIENTE', status: 409 });
    expect(await leerKardex(IDVariante)).toEqual({ ExistenciaFisica: 2, Movimientos: 1 });
  });
});
