import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP, ejecutarSPConjuntos } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { crearCupon, metodoEnvio, type ClienteDePrueba } from '../checkout/apoyo-checkout.js';
import { unaFila } from '../datos-de-prueba.js';
import { pedidoPagado } from './apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenOperador: string;
let tokenAdmin: string;
let estandar: number;

beforeAll(async () => {
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  estandar = await metodoEnvio(app);
});

const detalleSchema = z.object({
  estado: z.string(),
  total: z.string(),
  costoEnvio: z.string(),
  montoReembolsado: z.string(),
  lineas: z.array(
    z.object({
      idDetallePedido: z.number(),
      idVariante: z.number(),
      cantidad: z.number(),
      cantidadDevuelta: z.number(),
      totalLinea: z.string(),
    }),
  ),
});

const detalleDe = async (cliente: ClienteDePrueba, idPedido: number) =>
  leerDatos(
    await request(app)
      .get(`/api/v1/pedidos/${String(idPedido)}`)
      .set(comoCliente(cliente.token)),
    detalleSchema,
  );

async function entregado(idPedido: number) {
  for (const [esperado, nuevo] of [
    ['Pagado', 'EnPreparacion'],
    ['EnPreparacion', 'Despachado'],
    ['Despachado', 'Entregado'],
  ] as const) {
    await request(app)
      .post(`/api/v1/admin/pedidos/${String(idPedido)}/estado`)
      .set(comoCliente(tokenOperador))
      .send({ estadoEsperado: esperado, estadoNuevo: nuevo });
  }
}

const devolver = (idPedido: number, lineas: { idDetallePedido: number; cantidad: number }[]) =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/devoluciones`)
    .set(comoCliente(tokenOperador))
    .send({ motivo: 'El cliente lo devolvió', lineas });

const devolucionSchema = z.object({
  pedido: z.looseObject({ estado: z.string() }),
  devolucion: z.object({ idDevolucion: z.number(), montoReembolso: z.string() }),
  reembolso: z.object({ idReembolso: z.number(), estado: z.string() }),
});

interface FilaDevolucion {
  IDDevolucion: number;
  MontoReembolso: number;
  Fecha: Date;
  FechaLocal: string;
}

async function devolucionesDe(idPedido: number) {
  const [devoluciones, lineas] = await ejecutarSPConjuntos<
    [FilaDevolucion[], { IDDetallePedido: number; Cantidad: number; MontoReembolso: number }[]]
  >('SP_Pruebas_LeerDevoluciones', { IDPedido: { tipo: sql.Int, valor: idPedido } });
  return { devoluciones: devoluciones ?? [], lineas: lineas ?? [] };
}

const existencia = async (idVariante: number) =>
  (
    await unaFila<{ ExistenciaFisica: number }>('SP_Pruebas_LeerKardex', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
    })
  ).ExistenciaFisica;

async function pedidoEntregado(opciones?: Parameters<typeof pedidoPagado>[2]) {
  const resultado = await pedidoPagado(app, estandar, opciones);
  await entregado(resultado.pedido.idPedido);
  const detalle = await detalleDe(resultado.cliente, resultado.pedido.idPedido);
  return { ...resultado, detalle };
}

describe('devoluciones (E6-H04, N-10)', () => {
  it('parcial: DevueltoParcial, reingreso al inventario y reembolso del precio pagado de esa línea', async () => {
    const { cliente, pedido, detalle } = await pedidoEntregado({
      lineas: [
        { precio: '50.00', cantidad: 2 },
        { precio: '30.00', cantidad: 1 },
      ],
    });
    const linea = detalle.lineas.find((l) => l.cantidad === 2);
    if (linea === undefined) throw new Error('Falta la línea');
    const antes = await existencia(linea.idVariante);

    const respuesta = await devolver(pedido.idPedido, [
      { idDetallePedido: linea.idDetallePedido, cantidad: 1 },
    ]);

    expect(respuesta.status).toBe(201);
    const datos = leerDatos(respuesta, devolucionSchema);
    expect(datos).toMatchObject({
      pedido: { estado: 'DevueltoParcial' },
      devolucion: { montoReembolso: '50.00' },
      reembolso: { estado: 'Completado' },
    });
    expect(await existencia(linea.idVariante)).toBe(antes + 1);
    const despues = await detalleDe(cliente, pedido.idPedido);
    expect(despues.montoReembolsado).toBe('50.00');
    expect(
      despues.lineas.find((l) => l.idDetallePedido === linea.idDetallePedido)?.cantidadDevuelta,
    ).toBe(1);
  });

  it('total: devolver lo que falta deja el pedido Devuelto y el envío nunca se reembolsa', async () => {
    const { cliente, pedido, detalle } = await pedidoEntregado({
      lineas: [{ precio: '40.00', cantidad: 2 }],
    });
    const [linea] = detalle.lineas;
    if (linea === undefined) throw new Error('Falta la línea');

    await devolver(pedido.idPedido, [{ idDetallePedido: linea.idDetallePedido, cantidad: 1 }]);
    const ultima = await devolver(pedido.idPedido, [
      { idDetallePedido: linea.idDetallePedido, cantidad: 1 },
    ]);

    expect(leerDatos(ultima, devolucionSchema).pedido.estado).toBe('Devuelto');
    const final = await detalleDe(cliente, pedido.idPedido);
    expect(final.montoReembolsado).toBe(linea.totalLinea);
    expect(Number(final.total) - Number(final.montoReembolsado)).toBeCloseTo(
      Number(final.costoEnvio),
      2,
    );
  });

  it('el residuo de centavos va en la última devolución: la suma es exactamente lo pagado por la línea', async () => {
    const { codigo } = await crearCupon(app, tokenAdmin, { limiteUsosTotal: 3 });
    const { pedido, detalle } = await pedidoEntregado({
      lineas: [{ precio: '10.00', cantidad: 3 }],
      codigoCupon: codigo,
    });
    const [linea] = detalle.lineas;
    if (linea === undefined) throw new Error('Falta la línea');
    expect(linea.totalLinea).toBe('25.00');

    for (let i = 0; i < 3; i++) {
      await devolver(pedido.idPedido, [{ idDetallePedido: linea.idDetallePedido, cantidad: 1 }]);
    }

    const { lineas } = await devolucionesDe(pedido.idPedido);
    expect(lineas.map((l) => l.MontoReembolso)).toEqual([8.33, 8.33, 8.34]);
    expect(lineas.reduce((suma, l) => suma + Math.round(l.MontoReembolso * 100), 0)).toBe(2500);
  });

  it('no se devuelve más de lo vendido: 422 DEVOLUCION_EXCEDE_VENDIDO con lo que queda por línea', async () => {
    const { pedido, detalle } = await pedidoEntregado();
    const [linea] = detalle.lineas;
    if (linea === undefined) throw new Error('Falta la línea');

    const respuesta = await devolver(pedido.idPedido, [
      { idDetallePedido: linea.idDetallePedido, cantidad: 3 },
    ]);

    expect(respuesta.status).toBe(422);
    expect(leerError(respuesta)).toMatchObject({
      codigo: 'DEVOLUCION_EXCEDE_VENDIDO',
      detalles: [{ idDetallePedido: linea.idDetallePedido, cantidad: 3, disponible: 2 }],
    });
    expect((await devolucionesDe(pedido.idPedido)).devoluciones).toEqual([]);
  });

  it('ni con dos devoluciones simultáneas de la misma línea: una pasa y la otra recibe 422', async () => {
    // Con otra línea sin devolver, el pedido sigue en DevueltoParcial: la segunda choca con lo vendido.
    const { cliente, pedido, detalle } = await pedidoEntregado({
      lineas: [
        { precio: '50.00', cantidad: 2 },
        { precio: '30.00', cantidad: 1 },
      ],
    });
    const linea = detalle.lineas.find((l) => l.cantidad === 2);
    if (linea === undefined) throw new Error('Falta la línea');
    const toda = [{ idDetallePedido: linea.idDetallePedido, cantidad: 2 }];

    const respuestas = await Promise.all([
      devolver(pedido.idPedido, toda),
      devolver(pedido.idPedido, toda),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 422]);
    const rechazo = respuestas.find((r) => r.status === 422);
    expect(rechazo === undefined ? null : leerError(rechazo).codigo).toBe(
      'DEVOLUCION_EXCEDE_VENDIDO',
    );
    expect((await devolucionesDe(pedido.idPedido)).devoluciones).toHaveLength(1);
    expect((await detalleDe(cliente, pedido.idPedido)).montoReembolsado).toBe('100.00');
    const devuelta = (await detalleDe(cliente, pedido.idPedido)).lineas.find(
      (l) => l.idDetallePedido === linea.idDetallePedido,
    );
    expect(devuelta?.cantidadDevuelta).toBe(2);
  });

  it('solo pedidos entregados (409) y dentro de 30 días desde la entrega (422 PLAZO_DEVOLUCION_VENCIDO)', async () => {
    const pagado = await pedidoPagado(app, estandar);
    const lineaPagada = (await detalleDe(pagado.cliente, pagado.pedido.idPedido)).lineas[0];
    const viejo = await pedidoEntregado();
    await ejecutarSP('SP_Pruebas_EntregaAntigua', {
      IDPedido: { tipo: sql.Int, valor: viejo.pedido.idPedido },
      DiasAtras: { tipo: sql.Int, valor: 31 },
    });
    const reciente = await pedidoEntregado();
    await ejecutarSP('SP_Pruebas_EntregaAntigua', {
      IDPedido: { tipo: sql.Int, valor: reciente.pedido.idPedido },
      DiasAtras: { tipo: sql.Int, valor: 29 },
    });
    const uno = (idDetallePedido: number | undefined) => [
      { idDetallePedido: idDetallePedido ?? 0, cantidad: 1 },
    ];

    const sinEntregar = await devolver(pagado.pedido.idPedido, uno(lineaPagada?.idDetallePedido));
    const vencido = await devolver(
      viejo.pedido.idPedido,
      uno(viejo.detalle.lineas[0]?.idDetallePedido),
    );
    const enPlazo = await devolver(
      reciente.pedido.idPedido,
      uno(reciente.detalle.lineas[0]?.idDetallePedido),
    );

    expect([sinEntregar.status, leerError(sinEntregar).codigo]).toEqual([
      409,
      'TRANSICION_INVALIDA',
    ]);
    expect([vencido.status, leerError(vencido).codigo]).toEqual([422, 'PLAZO_DEVOLUCION_VENCIDO']);
    expect(enPlazo.status).toBe(201);
  });

  it('FechaLocal es el día de Guatemala de la devolución (05:59 UTC → día anterior; 06:00 → mismo día)', async () => {
    const { pedido, detalle } = await pedidoEntregado();
    await devolver(pedido.idPedido, [
      { idDetallePedido: detalle.lineas[0]?.idDetallePedido ?? 0, cantidad: 1 },
    ]);
    const fechaLocal = async (fechaUtc: Date) =>
      (
        await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
          FechaUtc: { tipo: sql.DateTime2(3), valor: fechaUtc },
        })
      ).FechaLocal;

    const [devolucion] = (await devolucionesDe(pedido.idPedido)).devoluciones;

    expect(devolucion?.FechaLocal).toBe(await fechaLocal(devolucion?.Fecha ?? new Date()));
    expect(await fechaLocal(new Date('2026-03-10T05:59:00Z'))).toBe('2026-03-09');
    expect(await fechaLocal(new Date('2026-03-10T06:00:00Z'))).toBe('2026-03-10');
  });

  it('valida las líneas: de otro pedido → 404, repetidas → 400; un Cliente no registra devoluciones (403)', async () => {
    const { cliente, pedido, detalle } = await pedidoEntregado();
    const otro = await pedidoEntregado();
    const [linea] = detalle.lineas;
    const ajena = otro.detalle.lineas[0]?.idDetallePedido ?? 0;

    const deOtroPedido = await devolver(pedido.idPedido, [{ idDetallePedido: ajena, cantidad: 1 }]);
    const repetidas = await devolver(pedido.idPedido, [
      { idDetallePedido: linea?.idDetallePedido ?? 0, cantidad: 1 },
      { idDetallePedido: linea?.idDetallePedido ?? 0, cantidad: 1 },
    ]);
    const comoCliente2 = await request(app)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/devoluciones`)
      .set(comoCliente(cliente.token))
      .send({
        motivo: 'x',
        lineas: [{ idDetallePedido: linea?.idDetallePedido ?? 0, cantidad: 1 }],
      });

    expect([deOtroPedido.status, repetidas.status, comoCliente2.status]).toEqual([404, 400, 403]);
  });
});
