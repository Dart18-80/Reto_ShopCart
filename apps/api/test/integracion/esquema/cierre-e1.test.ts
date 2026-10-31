import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { ejecutarConContexto } from '../../../src/shared/http/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';
import {
  ERROR_DE_CONSTRAINT,
  crearCupon,
  crearPedido,
  crearUsuario,
  crearVariante,
  unaFila,
} from '../datos-de-prueba.js';

interface FilaBitacora {
  Modulo: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
}

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

function comoAdministrador<T>(idUsuario: number, accion: () => Promise<T>): Promise<T> {
  return ejecutarConContexto({ requestId: randomUUID(), idUsuario, rol: 'Administrador' }, accion);
}

function leerBitacora(entidad: string, idEntidad: number): Promise<FilaBitacora[]> {
  return ejecutarSP<FilaBitacora>('SP_Pruebas_LeerBitacora', {
    Entidad: { tipo: sql.VarChar(50), valor: entidad },
    IDEntidad: { tipo: sql.VarChar(50), valor: String(idEntidad) },
  });
}

function violaConstraint(nombre: string) {
  return { number: ERROR_DE_CONSTRAINT, message: expect.stringContaining(nombre) as unknown };
}

const valores = (json: string | null): unknown => JSON.parse(json ?? 'null') as unknown;

describe('triggers de bitácora sin prueba hasta ahora (R4)', () => {
  it('Categoria y Producto registran el cambio de descripción y la desactivación', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    const { IDProducto, IDCategoria } = await comoAdministrador(IDUsuario, () =>
      unaFila<{ IDProducto: number; IDCategoria: number }>('SP_Pruebas_EditarCatalogo', {
        IDVariante: { tipo: sql.Int, valor: IDVariante },
      }),
    );

    const [categoria] = await leerBitacora('Categoria', IDCategoria);
    const [producto] = await leerBitacora('Producto', IDProducto);
    expect(categoria).toMatchObject({ Modulo: 'Catalogo', Accion: 'Modificar' });
    expect(valores(categoria?.ValorNuevo ?? null)).toMatchObject({
      Descripcion: 'Descripción editada',
    });
    expect(producto).toMatchObject({ Modulo: 'Catalogo', Accion: 'Desactivar' });
  });

  it('MetodoEnvio registra la creación, el cambio de costo y la eliminación', async () => {
    const idAdministrador = await crearUsuario();

    const { IDMetodoEnvio } = await comoAdministrador(idAdministrador, () =>
      unaFila<{ IDMetodoEnvio: number }>('SP_Pruebas_CicloMetodoEnvio'),
    );

    const filas = await leerBitacora('MetodoEnvio', IDMetodoEnvio);
    expect(filas.map((fila) => fila.Accion)).toEqual(['Eliminar', 'Modificar', 'Crear']);
    expect(filas.every((fila) => fila.Modulo === 'Envios')).toBe(true);
    expect(valores(filas[1]?.ValorAnterior ?? null)).toMatchObject({ Costo: 40 });
    expect(valores(filas[1]?.ValorNuevo ?? null)).toMatchObject({ Costo: 45 });
  });

  it('ParametroSistema registra cada cambio en Configuración con el valor anterior y el nuevo', async () => {
    const idAdministrador = await crearUsuario();

    const { MinutosReserva } = await comoAdministrador(idAdministrador, () =>
      unaFila<{ MinutosReserva: number }>('SP_Pruebas_TocarParametroSistema'),
    );

    const [vuelta, ida] = await leerBitacora('ParametroSistema', 1);
    expect(ida).toMatchObject({ Modulo: 'Configuracion', Accion: 'Modificar' });
    expect(valores(ida?.ValorNuevo ?? null)).toMatchObject({ MinutosReserva: MinutosReserva + 1 });
    expect(valores(vuelta?.ValorNuevo ?? null)).toMatchObject({ MinutosReserva });
  });

  function cambiarUsuario(idUsuario: number, cambio: string) {
    return ejecutarSP('SP_Pruebas_CambiarUsuario', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      Cambio: { tipo: sql.VarChar(20), valor: cambio },
    });
  }

  it('Usuario: la desactivación queda registrada sin HashContrasena', async () => {
    const idUsuario = await crearUsuario();

    await cambiarUsuario(idUsuario, 'Desactivar');

    const [fila] = await leerBitacora('Usuario', idUsuario);
    expect(fila).toMatchObject({ Modulo: 'Usuarios', Accion: 'Desactivar' });
    expect(`${fila?.ValorAnterior ?? ''}${fila?.ValorNuevo ?? ''}`).not.toContain('Hash');
  });

  it('Usuario: un cambio de contraseña no deja fila en la bitácora', async () => {
    const idUsuario = await crearUsuario();

    await cambiarUsuario(idUsuario, 'CambiarContrasena');

    expect((await leerBitacora('Usuario', idUsuario)).map((fila) => fila.Accion)).toEqual([
      'Crear',
    ]);
  });

  it('Usuario: un cambio de rol queda como Modificar con el rol anterior y el nuevo', async () => {
    const idUsuario = await crearUsuario();

    await cambiarUsuario(idUsuario, 'CambiarRol');

    const [fila] = await leerBitacora('Usuario', idUsuario);
    expect(fila?.Accion).toBe('Modificar');
    expect(valores(fila?.ValorAnterior ?? null)).not.toEqual(valores(fila?.ValorNuevo ?? null));
  });
});

describe('FU_Catalogo_PrecioVigente (R4, N-02)', () => {
  function precioVigente(idVariante: number) {
    return ejecutarSP<{ IDPrecioVariante: number; Precio: number }>(
      'SP_Pruebas_LeerPrecioVigente',
      {
        IDVariante: { tipo: sql.Int, valor: idVariante },
      },
    );
  }

  function cambiarPrecio(idVariante: number, precio: string) {
    return unaFila<{ IDPrecioVariante: number }>('SP_Pruebas_CambiarPrecioVariante', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
      Precio: { tipo: sql.Decimal(12, 2), valor: precio },
    });
  }

  it('sin precio no devuelve filas', async () => {
    const { IDVariante } = await crearVariante();

    expect(await precioVigente(IDVariante)).toEqual([]);
  });

  it('después de varios cambios devuelve solo la última versión', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();
    await comoAdministrador(IDUsuario, () => cambiarPrecio(IDVariante, '100.00'));

    const { IDPrecioVariante } = await comoAdministrador(IDUsuario, () =>
      cambiarPrecio(IDVariante, '120.00'),
    );

    expect(await precioVigente(IDVariante)).toEqual([{ IDPrecioVariante, Precio: 120 }]);
  });
});

describe('CK de Pedido y Cupon (R4, A-13)', () => {
  function probarTotales(idPedido: number, importes: Record<string, string>) {
    return ejecutarSP(
      'SP_Pruebas_ProbarTotalesPedido',
      Object.fromEntries([
        ['IDPedido', { tipo: sql.Int, valor: idPedido }],
        ...Object.entries(importes).map(([nombre, valor]) => [
          nombre,
          { tipo: sql.Decimal(12, 2), valor },
        ]),
      ]),
    );
  }

  const CONSISTENTE = {
    Subtotal: '100.00',
    Descuento: '0.00',
    CostoEnvio: '35.00',
    Total: '135.00',
    BaseImponible: '120.54',
    IVA: '14.46',
  };

  it('acepta importes consistentes', async () => {
    const idPedido = await crearPedido(await crearUsuario());

    await expect(probarTotales(idPedido, CONSISTENTE)).resolves.toBeDefined();
  });

  it.each([
    ['CK_Pedido_Total', { Total: '134.99', BaseImponible: '120.53' }],
    ['CK_Pedido_IVA', { IVA: '14.45' }],
    [
      'CK_Pedido_Descuento',
      { Descuento: '100.01', Total: '34.99', BaseImponible: '31.24', IVA: '3.75' },
    ],
  ])('rechaza importes inconsistentes: %s', async (constraint, cambios) => {
    const idPedido = await crearPedido(await crearUsuario());

    await expect(probarTotales(idPedido, { ...CONSISTENTE, ...cambios })).rejects.toMatchObject(
      violaConstraint(constraint),
    );
  });

  function probarCupon(idCupon: number, codigo: string, tipo: string, valor: string) {
    return ejecutarSP('SP_Pruebas_ProbarCupon', {
      IDCupon: { tipo: sql.Int, valor: idCupon },
      Codigo: { tipo: sql.VarChar(30), valor: codigo },
      Tipo: { tipo: sql.VarChar(10), valor: tipo },
      Valor: { tipo: sql.Decimal(12, 2), valor },
    });
  }

  const codigoUnico = () => `PRUEBA${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;

  it('el código del cupón debe estar en mayúsculas', async () => {
    const idCupon = await crearCupon(5);

    await expect(
      probarCupon(idCupon, codigoUnico().toLowerCase(), 'MontoFijo', '10.00'),
    ).rejects.toMatchObject(violaConstraint('CK_Cupon_CodigoMayusculas'));
  });

  it('un porcentaje acepta 100 y rechaza 100.01', async () => {
    const idCupon = await crearCupon(5);

    await expect(
      probarCupon(idCupon, codigoUnico(), 'Porcentaje', '100.00'),
    ).resolves.toBeDefined();
    await expect(probarCupon(idCupon, codigoUnico(), 'Porcentaje', '100.01')).rejects.toMatchObject(
      violaConstraint('CK_Cupon_Valor'),
    );
  });

  it('un monto fijo de 0 se rechaza', async () => {
    const idCupon = await crearCupon(5);

    await expect(probarCupon(idCupon, codigoUnico(), 'MontoFijo', '0.00')).rejects.toMatchObject(
      violaConstraint('CK_Cupon_Valor'),
    );
  });
});
