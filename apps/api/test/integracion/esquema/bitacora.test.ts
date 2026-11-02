import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  cambiarPrecio,
  comoActor,
  crearCupon,
  crearUsuario,
  crearVariante,
  ultimaBitacora,
} from '../datos-de-prueba.js';

const REQUEST_ID = '8f1c2e9a-0000-4000-8000-000000000005';

usarBaseDePruebas();

function modificarCupon(idCupon: number, descripcion: string, usosComprometidos: number) {
  return ejecutarSP('SP_Pruebas_ModificarCupon', {
    IDCupon: { tipo: sql.Int, valor: idCupon },
    Descripcion: { tipo: sql.NVarChar(200), valor: descripcion },
    UsosComprometidos: { tipo: sql.Int, valor: usosComprometidos },
  });
}

describe('Bitácora (E1-H04, RF-09)', () => {
  it('un cambio de precio registra usuario, fecha, entidad, acción, precio anterior y nuevo', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();
    const idAnterior = await comoActor(IDUsuario, 'Administrador', () =>
      cambiarPrecio(IDVariante, '100.00'),
    );

    const idNuevo = await comoActor(
      IDUsuario,
      'Administrador',
      () => cambiarPrecio(IDVariante, '120.00'),
      REQUEST_ID,
    );

    // 02 §3.10: IDEntidad es la PK del registro afectado, aquí la nueva versión de precio (R5).
    const fila = await ultimaBitacora('PrecioVariante', idNuevo);
    expect(fila).toMatchObject({ Modulo: 'Catalogo', Accion: 'Modificar', IDUsuario });
    expect(fila.RequestId?.toLowerCase()).toBe(REQUEST_ID);
    expect(fila.Fecha).toBeInstanceOf(Date);
    expect(JSON.parse(fila.ValorAnterior ?? '{}')).toMatchObject({
      IDPrecioVariante: idAnterior,
      IDVariante,
      Precio: '100.00',
    });
    expect(JSON.parse(fila.ValorNuevo ?? '{}')).toMatchObject({ IDVariante, Precio: '120.00' });
  });

  it('el primer precio de una variante queda como Crear con su propio IDPrecioVariante', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    const idPrimero = await comoActor(IDUsuario, 'Administrador', () =>
      cambiarPrecio(IDVariante, '80.00'),
    );

    expect(await ultimaBitacora('PrecioVariante', idPrimero)).toMatchObject({
      Accion: 'Crear',
      ValorAnterior: null,
    });
  });

  it('un cambio de existencia física queda en el módulo Inventario con el valor anterior y el nuevo', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    await comoActor(IDUsuario, 'Administrador', () =>
      ejecutarSP('SP_Pruebas_FijarExistencia', {
        IDVariante: { tipo: sql.Int, valor: IDVariante },
        ExistenciaFisica: { tipo: sql.Int, valor: 7 },
      }),
    );

    const fila = await ultimaBitacora('Variante', IDVariante);
    expect(fila).toMatchObject({ Modulo: 'Inventario', Accion: 'Modificar', IDUsuario });
    expect(JSON.parse(fila.ValorAnterior ?? '{}')).toMatchObject({ ExistenciaFisica: 0 });
    expect(JSON.parse(fila.ValorNuevo ?? '{}')).toMatchObject({ ExistenciaFisica: 7 });
  });

  it('un cambio en un cupón registra la descripción anterior y la nueva', async () => {
    const idUsuario = await crearUsuario();
    const idCupon = await crearCupon(5);

    await comoActor(idUsuario, 'Administrador', () =>
      modificarCupon(idCupon, 'Descripción nueva', 0),
    );

    const fila = await ultimaBitacora('Cupon', idCupon);
    expect(fila).toMatchObject({ Modulo: 'Cupones', Accion: 'Modificar', IDUsuario: idUsuario });
    expect(JSON.parse(fila.ValorNuevo ?? '{}')).toMatchObject({ Descripcion: 'Descripción nueva' });
  });

  it('un cambio solo del contador de usos del cupón no se registra', async () => {
    const idUsuario = await crearUsuario();
    const idCupon = await crearCupon(5);
    const antes = await ultimaBitacora('Cupon', idCupon);

    await comoActor(idUsuario, 'Administrador', () =>
      modificarCupon(idCupon, 'Cupón de prueba', 2),
    );

    expect(await ultimaBitacora('Cupon', idCupon)).toEqual(antes);
  });

  it('la creación de un usuario nunca registra su HashContrasena', async () => {
    const idUsuario = await crearUsuario();

    const fila = await ultimaBitacora('Usuario', idUsuario);

    expect(fila.Accion).toBe('Crear');
    expect(fila.ValorNuevo).not.toContain('hash-de-prueba');
    expect(fila.ValorNuevo).not.toContain('HashContrasena');
  });
});

describe('contexto obligatorio en la bitácora (A-18)', () => {
  it('una escritura auditada sin contexto falla con CONTEXTO_NO_ESTABLECIDO (500) y no queda nada', async () => {
    const intento = ejecutarSP('SP_Pruebas_EscribirSinContexto');

    await expect(intento).rejects.toMatchObject({ codigo: 'CONTEXTO_NO_ESTABLECIDO', status: 500 });
  });

  it('un job (fuera de una petición: rol Sistema) deja la fila con IDUsuario NULL', async () => {
    const idCupon = await crearCupon(5);

    await modificarCupon(idCupon, 'Cambio de un job', 0);

    expect(await ultimaBitacora('Cupon', idCupon)).toMatchObject({
      Accion: 'Modificar',
      IDUsuario: null,
    });
  });

  it('un administrador deja su IDUsuario en la fila', async () => {
    const idCupon = await crearCupon(5);
    const idAdministrador = await crearUsuario();

    await comoActor(idAdministrador, 'Administrador', () =>
      modificarCupon(idCupon, 'Cambio del administrador', 0),
    );

    expect(await ultimaBitacora('Cupon', idCupon)).toMatchObject({ IDUsuario: idAdministrador });
  });
});
