import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  cambiarPrecio,
  comoActor,
  crearCupon,
  crearPedido,
  crearUsuario,
  crearVariante,
  fijarExistencia,
  leerBitacora,
  unaFila,
  violaConstraint,
} from '../datos-de-prueba.js';
import { aMonto } from '../../../src/shared/dinero/index.js';

const ERROR_DE_RESTRICCION_UNICA = 2627;
// SP_Pruebas_CrearSesionCheckout congela Subtotal 100 + envío 35.
const TOTAL_PEDIDO_DE_PRUEBA = 135;

usarBaseDePruebas();

async function filasDe(entidad: string, idEntidad: number, accion: string) {
  return (await leerBitacora(entidad, idEntidad)).filter((fila) => fila.Accion === accion);
}

function cambioDeEstado(anterior: string, nuevo: string) {
  return expect.objectContaining({
    Accion: 'CambioEstado',
    ValorAnterior: expect.stringContaining(`"Estado":"${anterior}"`) as unknown,
    ValorNuevo: expect.stringContaining(`"Estado":"${nuevo}"`) as unknown,
  }) as unknown;
}

function cambiarEstados(idPedido1: number, estado1: string, idPedido2: number, estado2: string) {
  return ejecutarSP('SP_Pruebas_CambiarEstadoPedidos', {
    IDPedido1: { tipo: sql.Int, valor: idPedido1 },
    CodigoEstado1: { tipo: sql.VarChar(20), valor: estado1 },
    IDPedido2: { tipo: sql.Int, valor: idPedido2 },
    CodigoEstado2: { tipo: sql.VarChar(20), valor: estado2 },
  });
}

function crearDetalle(idPedido: number, idVariante: number, cantidad: number) {
  return ejecutarSP('SP_Pruebas_CrearDetallePedido', {
    IDPedido: { tipo: sql.Int, valor: idPedido },
    IDVariante: { tipo: sql.Int, valor: idVariante },
    Cantidad: { tipo: sql.Int, valor: cantidad },
  });
}

/** Pedido Pagado con una línea de `cantidad` unidades de una variante nueva con precio. */
async function pedidoConLinea(cantidad: number) {
  const variante = await crearVariante();
  await comoActor(variante.IDUsuario, 'Administrador', () =>
    cambiarPrecio(variante.IDVariante, '50.00'),
  );
  const idPedido = await crearPedido(await crearUsuario());
  await crearDetalle(idPedido, variante.IDVariante, cantidad);
  return { idPedido, variante };
}

describe('triggers con varias filas en un solo UPDATE', () => {
  it('TR_Pedidos_Bitacora registra un CambioEstado por cada pedido, con sus propios valores', async () => {
    const [pedido1, pedido2] = [
      await crearPedido(await crearUsuario()),
      await crearPedido(await crearUsuario()),
    ];
    const idOperador = await crearUsuario();

    await comoActor(idOperador, 'Operador', () =>
      cambiarEstados(pedido1, 'EnPreparacion', pedido2, 'Cancelado'),
    );

    // La lista completa: un JOIN mal hecho entre inserted y deleted dejaría filas cruzadas o de más.
    expect(await leerBitacora('Pedido', pedido1)).toEqual([
      cambioDeEstado('Pagado', 'EnPreparacion'),
    ]);
    expect(await leerBitacora('Pedido', pedido2)).toEqual([cambioDeEstado('Pagado', 'Cancelado')]);
  });

  it('TR_Pedidos_ValidarTransicion rechaza el UPDATE completo si una sola fila es inválida', async () => {
    const [valido, invalido] = [
      await crearPedido(await crearUsuario()),
      await crearPedido(await crearUsuario()),
    ];
    const idOperador = await crearUsuario();

    const intento = comoActor(idOperador, 'Operador', () =>
      cambiarEstados(valido, 'EnPreparacion', invalido, 'Despachado'),
    );

    await expect(intento).rejects.toMatchObject({ codigo: 'TRANSICION_INVALIDA' });
    // Sigue en Pagado: la transición Pagado → EnPreparacion todavía es posible y es la primera registrada.
    await comoActor(idOperador, 'Operador', () =>
      cambiarEstados(valido, 'EnPreparacion', invalido, 'EnPreparacion'),
    );
    expect(await leerBitacora('Pedido', valido)).toEqual([
      cambioDeEstado('Pagado', 'EnPreparacion'),
    ]);
  });

  it('TR_Cupones_Bitacora registra una fila por cupón, cada una con su valor anterior', async () => {
    const [cupon1, cupon2] = [await crearCupon(5), await crearCupon(5)];
    const idAdministrador = await crearUsuario();

    await comoActor(idAdministrador, 'Administrador', () =>
      ejecutarSP('SP_Pruebas_ModificarCupones', {
        IDCupon1: { tipo: sql.Int, valor: cupon1 },
        IDCupon2: { tipo: sql.Int, valor: cupon2 },
        Sufijo: { tipo: sql.NVarChar(20), valor: ' (editado)' },
      }),
    );

    for (const idCupon of [cupon1, cupon2]) {
      const modificaciones = await filasDe('Cupon', idCupon, 'Modificar');
      expect(modificaciones).toHaveLength(1);
      expect(modificaciones[0]?.ValorAnterior).not.toContain('(editado)');
      expect(modificaciones[0]?.ValorNuevo).toContain('(editado)');
    }
  });

  it('TR_Catalogo_VarianteBitacora registra la existencia de cada variante en Inventario', async () => {
    const [variante1, variante2] = [await crearVariante(), await crearVariante()];

    await comoActor(variante1.IDUsuario, 'Operador', () =>
      ejecutarSP('SP_Pruebas_FijarExistencias', {
        IDVariante1: { tipo: sql.Int, valor: variante1.IDVariante },
        Existencia1: { tipo: sql.Int, valor: 5 },
        IDVariante2: { tipo: sql.Int, valor: variante2.IDVariante },
        Existencia2: { tipo: sql.Int, valor: 9 },
      }),
    );

    const modificaciones1 = await filasDe('Variante', variante1.IDVariante, 'Modificar');
    const modificaciones2 = await filasDe('Variante', variante2.IDVariante, 'Modificar');
    expect(modificaciones1).toEqual([
      expect.objectContaining({
        Modulo: 'Inventario',
        ValorNuevo: expect.stringContaining('"ExistenciaFisica":5') as unknown,
      }),
    ]);
    expect(modificaciones2).toEqual([
      expect.objectContaining({
        Modulo: 'Inventario',
        ValorNuevo: expect.stringContaining('"ExistenciaFisica":9') as unknown,
      }),
    ]);
  });
});

describe('constraints en el límite', () => {
  function probarParametros(minutosReserva: number, montoEnvioGratis: string | null) {
    return ejecutarSP('SP_Pruebas_ProbarParametroSistema', {
      MinutosReserva: { tipo: sql.SmallInt, valor: minutosReserva },
      MontoEnvioGratis: { tipo: sql.Decimal(12, 2), valor: montoEnvioGratis },
    });
  }

  it.each([5, 60])('ParametroSistema acepta MinutosReserva en el límite (%i)', async (minutos) => {
    await expect(probarParametros(minutos, '500.00')).resolves.toBeDefined();
  });

  it.each([4, 61])(
    'ParametroSistema rechaza MinutosReserva fuera del rango (%i)',
    async (minutos) => {
      await expect(probarParametros(minutos, '500.00')).rejects.toMatchObject(
        violaConstraint('CK_ParametroSistema_MinutosReserva'),
      );
    },
  );

  it('ParametroSistema acepta MontoEnvioGratis NULL (sin envío gratis) y 0.01', async () => {
    await expect(probarParametros(15, null)).resolves.toBeDefined();
    await expect(probarParametros(15, '0.01')).resolves.toBeDefined();
  });

  it('ParametroSistema rechaza MontoEnvioGratis en 0', async () => {
    await expect(probarParametros(15, '0.00')).rejects.toMatchObject(
      violaConstraint('CK_ParametroSistema_MontoEnvioGratis'),
    );
  });

  function crearUsuarioCon(correo: string, telefono: string | null, nombre = 'Cliente de prueba') {
    return unaFila<{ CorreoNormalizado: string; Telefono: string | null; Nombre: string }>(
      'SP_Pruebas_CrearUsuarioConDatos',
      {
        Correo: { tipo: sql.NVarChar(254), valor: correo },
        Telefono: { tipo: sql.VarChar(8), valor: telefono },
        Nombre: { tipo: sql.NVarChar(100), valor: nombre },
      },
    );
  }

  const correoUnico = () => `prueba-${randomUUID()}@shopcart.test`;

  it.each([
    ['8 dígitos', '55554444'],
    ['NULL (opcional)', null],
  ])('Usuario acepta un teléfono con %s', async (_caso, telefono) => {
    await expect(crearUsuarioCon(correoUnico(), telefono)).resolves.toMatchObject({
      Telefono: telefono,
    });
  });

  it.each([
    ['7 dígitos', '5555444'],
    ['una letra', '5555444a'],
    ['un espacio', '5555 444'],
  ])('Usuario rechaza un teléfono con %s', async (_caso, telefono) => {
    await expect(crearUsuarioCon(correoUnico(), telefono)).rejects.toMatchObject(
      violaConstraint('CK_Usuario_Telefono'),
    );
  });

  it('N-15: el correo es único sin distinguir mayúsculas', async () => {
    const correo = `Ana.Prueba-${randomUUID()}@ShopCart.Test`;
    const creado = await crearUsuarioCon(correo, null);

    expect(creado.CorreoNormalizado).toBe(correo.toLowerCase());
    await expect(crearUsuarioCon(correo.toLowerCase(), null)).rejects.toMatchObject(
      violaConstraint('UQ_Usuario_CorreoNormalizado', ERROR_DE_RESTRICCION_UNICA),
    );
  });

  it('guarda y devuelve sin pérdida tildes, ñ y emojis (NVARCHAR)', async () => {
    const nombre = 'José Ñandú de Sololá 🙂';

    await expect(crearUsuarioCon(correoUnico(), null, nombre)).resolves.toMatchObject({
      Nombre: nombre,
    });
  });

  it('PrecioVariante rechaza un precio de 0 y acepta 0.01', async () => {
    const { IDVariante, IDUsuario } = await crearVariante();

    await comoActor(IDUsuario, 'Administrador', async () => {
      await expect(cambiarPrecio(IDVariante, '0.00')).rejects.toMatchObject(
        violaConstraint('CK_PrecioVariante_PrecioPositivo'),
      );
      await expect(cambiarPrecio(IDVariante, '0.01')).resolves.toBeDefined();
    });
  });

  it('Variante rechaza una existencia física de -1', async () => {
    const { IDVariante } = await crearVariante();

    await expect(fijarExistencia(IDVariante, -1)).rejects.toMatchObject(
      violaConstraint('CK_Variante_ExistenciaNoNegativa'),
    );
  });

  function probarMontoReembolsado(idPedido: number, monto: string) {
    return ejecutarSP('SP_Pruebas_ProbarMontoReembolsado', {
      IDPedido: { tipo: sql.Int, valor: idPedido },
      MontoReembolsado: { tipo: sql.Decimal(12, 2), valor: monto },
    });
  }

  it.each(['0.00', `${String(TOTAL_PEDIDO_DE_PRUEBA)}.00`])(
    'A-13: Pedido acepta MontoReembolsado en el límite (%s)',
    async (monto) => {
      const idPedido = await crearPedido(await crearUsuario());

      await expect(probarMontoReembolsado(idPedido, monto)).resolves.toBeDefined();
    },
  );

  it.each(['-0.01', `${String(TOTAL_PEDIDO_DE_PRUEBA)}.01`])(
    'A-13: Pedido rechaza MontoReembolsado fuera de 0..Total (%s)',
    async (monto) => {
      const idPedido = await crearPedido(await crearUsuario());

      await expect(probarMontoReembolsado(idPedido, monto)).rejects.toMatchObject(
        violaConstraint('CK_Pedido_MontoReembolsado'),
      );
    },
  );

  it('N-10: DetallePedido acepta devolver exactamente lo vendido y rechaza una unidad más o un negativo', async () => {
    const { idPedido, variante } = await pedidoConLinea(3);
    const probar = (cantidad: number) =>
      ejecutarSP('SP_Pruebas_ProbarCantidadDevuelta', {
        IDPedido: { tipo: sql.Int, valor: idPedido },
        IDVariante: { tipo: sql.Int, valor: variante.IDVariante },
        CantidadDevuelta: { tipo: sql.Int, valor: cantidad },
      });

    await expect(probar(3)).resolves.toBeDefined();
    for (const cantidad of [4, -1]) {
      await expect(probar(cantidad)).rejects.toMatchObject(
        violaConstraint('CK_DetallePedido_CantidadDevuelta'),
      );
    }
  });
});

describe('vistas sin prueba hasta ahora', () => {
  it('VW_Inventario_ExistenciaBodega suma lo pagado sin despachar y lo descuenta al despachar (N-07)', async () => {
    const { idPedido, variante } = await pedidoConLinea(3);
    await fijarExistencia(variante.IDVariante, 10);
    const leer = () =>
      unaFila<{ ExistenciaBodega: number }>('SP_Pruebas_LeerExistenciaBodega', {
        IDVariante: { tipo: sql.Int, valor: variante.IDVariante },
      });
    const idOperador = await crearUsuario();
    const pasarA = (estado: string) =>
      comoActor(idOperador, 'Operador', () =>
        ejecutarSP('SP_Pruebas_CambiarEstadoPedido', {
          IDPedido: { tipo: sql.Int, valor: idPedido },
          CodigoEstado: { tipo: sql.VarChar(20), valor: estado },
        }),
      );

    expect((await leer()).ExistenciaBodega).toBe(13);
    await pasarA('EnPreparacion');
    expect((await leer()).ExistenciaBodega).toBe(13);
    await pasarA('Despachado');
    expect((await leer()).ExistenciaBodega).toBe(10);
  });

  function buscar(patron: string) {
    return ejecutarSP<{ Nombre: string; PrecioMinimo: number; TieneDisponible: boolean }>(
      'SP_Pruebas_BuscarProductosTienda',
      { Patron: { tipo: sql.NVarChar(150), valor: patron } },
    );
  }

  it.each([
    ['%cardigan%', 'Cárdigan de punto'],
    ['%SUETER DE LANA%', 'Suéter de lana tejido'],
    ['%pantalon chino%', 'Pantalón chino'],
  ])('A-10: "%s" encuentra "%s" sin distinguir mayúsculas ni tildes', async (patron, nombre) => {
    const encontrados = await buscar(patron);

    expect(encontrados.map((producto) => producto.Nombre)).toEqual([nombre]);
  });

  it('VW_Catalogo_ProductosTienda no muestra un producto desactivado', async () => {
    expect(await buscar('%short de mezclilla%')).toEqual([]);
  });

  it('VW_Catalogo_ProductosTienda calcula el precio mínimo y si hay disponible', async () => {
    const [chino] = await buscar('%pantalon chino%');
    const [edicionLimitada] = await buscar('%edicion limitada%');

    expect(aMonto(chino?.PrecioMinimo ?? Number.NaN).toFixed(2)).toBe('299.00');
    expect(edicionLimitada?.TieneDisponible).toBe(true);
  });

  it('VW_Pedidos_Historial muestra el número de pedido, los estados y el rol de quien cambió', async () => {
    const idCliente = await crearUsuario();
    const idPedido = await crearPedido(idCliente);

    const historial = await unaFila<Record<string, unknown>>(
      'SP_Pruebas_RegistrarHistorialPedido',
      {
        IDPedido: { tipo: sql.Int, valor: idPedido },
        IDUsuario: { tipo: sql.Int, valor: idCliente },
      },
    );

    expect(historial).toMatchObject({
      NumeroPedido: `SC-${String(idPedido).padStart(6, '0')}`,
      CodigoEstadoAnterior: null,
      CodigoEstadoNuevo: 'Pagado',
      EstadoNuevo: 'Pagado',
      IDUsuario: idCliente,
      RolUsuario: 'Cliente',
    });
  });
});
