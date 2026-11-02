import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { varianteVendible } from '../carrito/apoyo-carrito.js';
import { comoActor, crearSesionCheckout, crearUsuario } from '../datos-de-prueba.js';

usarBaseDePruebas();

interface FilaReserva {
  IDReserva: number;
  IDVariante: number;
  Cantidad: number;
  Estado: string;
  Vigente: boolean;
}

type Lineas = { idVariante: number; cantidad: number }[];

async function sesionNueva() {
  const idUsuario = await crearUsuario();
  return { idUsuario, idSesion: await crearSesionCheckout(idUsuario) };
}

const reservar = (idUsuario: number, idSesion: number, lineas: Lineas) =>
  comoActor(idUsuario, 'Cliente', () =>
    ejecutarSP<FilaReserva>('SP_Pruebas_ReservarExistencia', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
      Lineas: { tipo: sql.NVarChar(sql.MAX), valor: JSON.stringify(lineas) },
    }),
  );

const reservasDe = (idSesion: number) =>
  ejecutarSP<{ IDVariante: number; Cantidad: number; Estado: string }>(
    'SP_Pruebas_LeerReservasSesion',
    {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    },
  );

describe('SP_Inventario_ReservarExistencia (N-06, nombre del enunciado)', () => {
  it('reserva cada línea, Activa y vigente, una fila por variante', async () => {
    const [a, b] = await Promise.all([varianteVendible('10.00', 5), varianteVendible('10.00', 5)]);
    const { idUsuario, idSesion } = await sesionNueva();

    const reservas = await reservar(idUsuario, idSesion, [
      { idVariante: b.IDVariante, cantidad: 2 },
      { idVariante: a.IDVariante, cantidad: 5 },
    ]);

    const esperadas = [
      { IDVariante: a.IDVariante, Cantidad: 5, Estado: 'Activa', Vigente: true },
      { IDVariante: b.IDVariante, Cantidad: 2, Estado: 'Activa', Vigente: true },
    ].toSorted((x, y) => x.IDVariante - y.IDVariante);
    expect(reservas.map(({ IDReserva: _id, ...resto }) => resto)).toEqual(esperadas);
  });

  it('todo o nada: si una línea no alcanza, 50301 con el detalle de las que fallan y ninguna reserva', async () => {
    const [alcanza, falta] = await Promise.all([
      varianteVendible('10.00', 5),
      varianteVendible('10.00', 1),
    ]);
    const { idUsuario, idSesion } = await sesionNueva();

    const intento = reservar(idUsuario, idSesion, [
      { idVariante: alcanza.IDVariante, cantidad: 2 },
      { idVariante: falta.IDVariante, cantidad: 3 },
    ]);

    await expect(intento).rejects.toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [
        {
          idVariante: falta.IDVariante,
          cantidad: 3,
          disponible: 1,
          producto: expect.any(String) as unknown,
        },
      ],
    });
    expect(await reservasDe(idSesion)).toEqual([]);
  });

  it('cuenta las reservas vigentes de otras sesiones', async () => {
    const variante = await varianteVendible('10.00', 3);
    const primera = await sesionNueva();
    const segunda = await sesionNueva();
    await reservar(primera.idUsuario, primera.idSesion, [
      { idVariante: variante.IDVariante, cantidad: 2 },
    ]);

    const intento = reservar(segunda.idUsuario, segunda.idSesion, [
      { idVariante: variante.IDVariante, cantidad: 2 },
    ]);

    await expect(intento).rejects.toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: variante.IDVariante, disponible: 1 }],
    });
  });

  it('una reserva vencida de la misma sesión se renueva en su fila (UQ por sesión y variante), sin insertar otra', async () => {
    const variante = await varianteVendible('10.00', 5);
    const { idUsuario, idSesion } = await sesionNueva();
    const [original] = await reservar(idUsuario, idSesion, [
      { idVariante: variante.IDVariante, cantidad: 2 },
    ]);
    await ejecutarSP('SP_Pruebas_VencerReservasSesion', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    });

    const renovadas = await reservar(idUsuario, idSesion, [
      { idVariante: variante.IDVariante, cantidad: 2 },
    ]);

    expect(renovadas).toEqual([
      {
        IDReserva: original?.IDReserva,
        IDVariante: variante.IDVariante,
        Cantidad: 2,
        Estado: 'Activa',
        Vigente: true,
      },
    ]);
  });

  it('exige la transacción del llamador: 50005 INVARIANTE_INTERNA y nada se escribe', async () => {
    const variante = await varianteVendible('10.00', 5);
    const { idUsuario, idSesion } = await sesionNueva();

    const intento = comoActor(idUsuario, 'Cliente', () =>
      ejecutarSP('SP_Pruebas_ReservarExistenciaSinTransaccion', {
        IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
        Lineas: {
          tipo: sql.NVarChar(sql.MAX),
          valor: JSON.stringify([{ idVariante: variante.IDVariante, cantidad: 1 }]),
        },
      }),
    );

    await expect(intento).rejects.toMatchObject({ codigo: 'INVARIANTE_INTERNA' });
    expect(await reservasDe(idSesion)).toEqual([]);
  });
});
