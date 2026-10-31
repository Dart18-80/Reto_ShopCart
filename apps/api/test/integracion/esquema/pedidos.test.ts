import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { AppError } from '../../../src/shared/errors/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoActor, crearPedido, crearUsuario } from '../datos-de-prueba.js';

usarBaseDePruebas();

function cambiarEstado(idPedido: number, codigoEstado: string) {
  return ejecutarSP('SP_Pruebas_CambiarEstadoPedido', {
    IDPedido: { tipo: sql.Int, valor: idPedido },
    CodigoEstado: { tipo: sql.VarChar(20), valor: codigoEstado },
  });
}

describe('TR_Pedidos_ValidarTransicion (E1-H04, N-08)', () => {
  it('rechaza con 50701 una transición que no existe para el rol (Cliente: Pagado → Despachado)', async () => {
    const idUsuario = await crearUsuario();
    const idPedido = await crearPedido(idUsuario);

    const error: unknown = await comoActor(idUsuario, 'Cliente', () =>
      cambiarEstado(idPedido, 'Despachado'),
    ).catch((rechazo: unknown) => rechazo);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'TRANSICION_INVALIDA', status: 409 });
  });

  it('rechaza una transición permitida a otro rol (Cliente no puede pasar a EnPreparacion)', async () => {
    const idUsuario = await crearUsuario();
    const idPedido = await crearPedido(idUsuario);

    const intento = comoActor(idUsuario, 'Cliente', () => cambiarEstado(idPedido, 'EnPreparacion'));

    await expect(intento).rejects.toMatchObject({ codigo: 'TRANSICION_INVALIDA' });
  });

  it('acepta una transición permitida para el rol (Operador: Pagado → EnPreparacion)', async () => {
    const idPedido = await crearPedido(await crearUsuario());
    const idOperador = await crearUsuario();

    const resultado = comoActor(idOperador, 'Operador', () =>
      cambiarEstado(idPedido, 'EnPreparacion'),
    );

    await expect(resultado).resolves.toBeDefined();
  });

  it('un job (rol Sistema) no tiene transiciones: rechaza el cambio de estado', async () => {
    const idPedido = await crearPedido(await crearUsuario());

    await expect(cambiarEstado(idPedido, 'Cancelado')).rejects.toMatchObject({
      codigo: 'TRANSICION_INVALIDA',
    });
  });
});
