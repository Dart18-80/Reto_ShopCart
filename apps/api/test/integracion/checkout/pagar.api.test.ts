import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { agregar, comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import { unaFila } from '../datos-de-prueba.js';
import {
  clienteConCarrito,
  crearCupon,
  estadoEnPasarela,
  iniciarPago,
  intentosDe,
  leerPedido,
  leerSesionPago,
  metodoEnvio,
  moverArrendamiento,
  pagar,
  pagoDe,
  TARJETA_RECHAZADA,
  TARJETA_TIEMPO_AGOTADO,
  type ClienteDePrueba,
} from './apoyo-checkout.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const DIA_MS = 24 * 60 * 60 * 1000;

let tokenAdmin: string;
let estandar: number;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  estandar = await metodoEnvio(app);
});

/** Un cliente con una sesión de pago iniciada (1 línea) y su id de sesión. */
async function clienteConSesion(precio = '100.00', cantidad = 2, existencia = 10, cupon?: string) {
  const { IDVariante } = await varianteVendible(precio, existencia);
  const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad }]);
  if (cupon !== undefined) {
    await request(app)
      .put('/api/v1/carrito/cupon')
      .set(comoCliente(cliente.token))
      .send({ codigo: cupon });
  }
  const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));
  return { cliente, idSesion: sesion.idSesion, idVariante: IDVariante, total: sesion.total };
}

describe('confirmar el pago (E5-H03, 01 §6.2)', () => {
  it('autoriza, crea el pedido con sus copias, IVA, kardex e historial, captura y responde 201', async () => {
    const { cliente, idSesion, idVariante } = await clienteConSesion('100.00', 2);
    const llave = randomUUID();

    const respuesta = await pagar(app, cliente.token, llave);

    expect(respuesta.status).toBe(201);
    const pedido = leerPedido(respuesta);
    expect(pedido).toMatchObject({
      numeroPedido: expect.stringMatching(/^SC-\d{6}$/) as unknown,
      estado: 'Pagado',
      subtotal: '200.00',
      costoEnvio: '35.00',
      total: '235.00',
      baseImponible: '209.82',
      iva: '25.18',
      tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
      lineas: [{ idVariante, cantidad: 2 }],
    });
    expect(await pagoDe(idSesion)).toMatchObject({
      Pedidos: 1,
      Detalles: 1,
      SalidasKardex: 1,
      Historial: 1,
      EstadoSesion: 'Pagada',
      EstadoCarrito: 'Convertido',
      EstadoReserva: 'Consumida',
    });
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Capturado', Arrendado: false }]);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
  });

  it('FechaPagoLocal es el día de Guatemala de FechaPago, y 05:59/06:00 UTC caen en días distintos', async () => {
    const { cliente } = await clienteConSesion();
    const pedido = leerPedido(await pagar(app, cliente.token, randomUUID()));
    const fechaLocal = async (fechaUtc: string) =>
      (
        await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
          FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(fechaUtc) },
        })
      ).FechaLocal;

    expect(pedido.fechaPagoLocal).toBe(await fechaLocal(pedido.fechaPago));
    expect(await fechaLocal('2026-11-02T05:59:59.999Z')).toBe('2026-11-01');
    expect(await fechaLocal('2026-11-02T06:00:00.000Z')).toBe('2026-11-02');
  });

  it('el pedido confirma el uso del cupón', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const codigo = `P${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    await request(app)
      .post('/api/v1/admin/cupones')
      .set(comoCliente(tokenAdmin))
      .send({
        codigo,
        descripcion: 'Cupón de pago',
        tipo: 'MontoFijo',
        valor: '10.00',
        fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
        fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
        limiteUsosTotal: 3,
      });
    await request(app)
      .put('/api/v1/carrito/cupon')
      .set(comoCliente(cliente.token))
      .send({ codigo });
    const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));

    const pedido = leerPedido(await pagar(app, cliente.token, randomUUID()));

    expect(pedido).toMatchObject({ codigoCupon: codigo, descuento: '10.00', total: '125.00' });
    expect((await pagoDe(sesion.idSesion)).EstadoUsoCupon).toBe('Confirmado');
  });

  it('sin Idempotency-Key o con una que no es UUID responde 400', async () => {
    const { cliente } = await clienteConSesion();

    const sinLlave = await request(app)
      .post('/api/v1/checkout/sesion/pagos')
      .set(comoCliente(cliente.token))
      .send({
        numeroTarjeta: '4242424242424242',
        mesVencimiento: 12,
        anioVencimiento: 2030,
        cvv: '731',
      });
    const malFormada = await pagar(app, cliente.token, 'no-es-uuid');

    expect([sinLlave.status, malFormada.status]).toEqual([400, 400]);
  });
});

describe('idempotencia (E5-H03, N-03)', () => {
  it('doble clic con la misma llave: un solo pedido y un solo cobro; el reintento recibe el mismo pedido', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    const llave = randomUUID();

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => pagar(app, cliente.token, llave)),
    );
    const despues = await pagar(app, cliente.token, llave);

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    const enCurso = respuestas.filter((r) => r.status === 409);
    expect(enCurso).toHaveLength(4);
    expect(enCurso.every((r) => leerError(r).codigo === 'PAGO_EN_CURSO')).toBe(true);
    expect(enCurso.every((r) => Number(r.headers['retry-after']) >= 1)).toBe(true);
    expect(despues.status).toBe(200);
    expect(leerPedido(despues).idPedido).toBe(
      leerPedido(respuestas.find((r) => r.status === 201) ?? despues).idPedido,
    );
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
    expect(await intentosDe(idSesion)).toHaveLength(1);
  });

  it('la misma llave con otra tarjeta responde 422 LLAVE_REUTILIZADA', async () => {
    const { cliente } = await clienteConSesion();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave);

    const otra = await pagar(app, cliente.token, llave, TARJETA_RECHAZADA);

    expect(leerError(otra).codigo).toBe('LLAVE_REUTILIZADA');
  });

  it('la llave de otro cliente responde 422 (sin revelar de quién es)', async () => {
    const a = await clienteConSesion();
    const b = await clienteConSesion();
    const llave = randomUUID();
    await pagar(app, a.cliente.token, llave);

    const ajena = await pagar(app, b.cliente.token, llave);

    expect(leerError(ajena).codigo).toBe('LLAVE_REUTILIZADA');
  });

  it('la llave de una sesión ya pagada, usada para una compra nueva, responde 422 y no da por pagada la nueva', async () => {
    const { cliente } = await clienteConSesion();
    const llave = randomUUID();
    expect((await pagar(app, cliente.token, llave)).status).toBe(201);
    const { IDVariante } = await varianteVendible('20.00', 5);
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const nueva = leerSesionPago(await iniciarPago(app, cliente, estandar));

    const reutilizada = await pagar(app, cliente.token, llave);

    expect(reutilizada.status).toBe(422);
    expect(leerError(reutilizada).codigo).toBe('LLAVE_REUTILIZADA');
    expect(await pagoDe(nueva.idSesion)).toMatchObject({ Pedidos: 0, EstadoSesion: 'Activa' });
  });

  it('sesión ya pagada con una llave nueva: 200 con el pedido existente, sin otro intento', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    const pedido = leerPedido(await pagar(app, cliente.token, randomUUID()));

    const otra = await pagar(app, cliente.token, randomUUID());

    expect(otra.status).toBe(200);
    expect(leerPedido(otra).idPedido).toBe(pedido.idPedido);
    expect(await intentosDe(idSesion)).toHaveLength(1);
  });

  it('una llave nueva mientras otro intento de la sesión está en curso responde 409', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    await unaFila('SP_Pruebas_InsertarIntentoPago', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
      Estado: { tipo: sql.VarChar(12), valor: 'Pendiente' },
    });

    const respuesta = await pagar(app, cliente.token, randomUUID());

    expect(leerError(respuesta).codigo).toBe('PAGO_EN_CURSO');
  });

  it('sin sesión de pago responde 404', async () => {
    const cliente: ClienteDePrueba = await clienteConCarrito(app, []);

    const respuesta = await pagar(app, cliente.token, randomUUID());

    expect(respuesta.status).toBe(404);
  });
});

describe('timeout y arrendamiento (E5-H03, N-03)', () => {
  it('4000…0119: 504 PAGO_SIN_CONFIRMAR con el arrendamiento liberado; el reintento completa con un solo cobro', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    const llave = randomUUID();

    const primera = await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    const intentoTrasTimeout = await intentosDe(idSesion);
    const reintento = await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    expect(primera.status).toBe(504);
    expect(leerError(primera)).toMatchObject({
      codigo: 'PAGO_SIN_CONFIRMAR',
      mensaje: expect.stringContaining('no se te cobrará dos veces') as unknown,
    });
    expect(intentoTrasTimeout).toMatchObject([{ Estado: 'Pendiente', Arrendado: false }]);
    expect(reintento.status).toBe(201);
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
  });

  it('el reintento de 0119 en la otra réplica recibe la misma autorización', async () => {
    const replica1 = crearApp(dependenciasDePrueba({ instancia: 'api-1' }));
    const replica2 = crearApp(dependenciasDePrueba({ instancia: 'api-2' }));
    const { cliente, idSesion } = await clienteConSesion();
    const llave = randomUUID();

    const primera = await pagar(replica1, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    const reintento = await pagar(replica2, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    expect([primera.status, reintento.status]).toEqual([504, 201]);
    const [intento] = await intentosDe(idSesion);
    expect(intento?.Estado).toBe('Capturado');
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
  });

  it('con el arrendamiento vivo la misma llave responde 409 con Retry-After; vencido, retoma y completa', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    const [intento] = await intentosDe(idSesion);
    await moverArrendamiento(intento?.IDIntentoPago ?? '0', 30);

    const durante = await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);
    await moverArrendamiento(intento?.IDIntentoPago ?? '0', -1);
    const despues = await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    expect(durante.status).toBe(409);
    expect(Number(durante.headers['retry-after'])).toBeGreaterThanOrEqual(25);
    expect(despues.status).toBe(201);
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Capturado' }]);
  });

  it('dos retomas simultáneas del mismo intento: solo una avanza', async () => {
    const { cliente, idSesion } = await clienteConSesion();
    const llave = randomUUID();
    await pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO);

    const retomas = await Promise.all([
      pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO),
      pagar(app, cliente.token, llave, TARJETA_TIEMPO_AGOTADO),
    ]);

    expect(retomas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
  });
});

describe('rechazos (E5-H03, N-03)', () => {
  const sesionConCupon = async () => {
    const { codigo } = await crearCupon(app, tokenAdmin, { limiteUsosTotal: 3 });
    return clienteConSesion('100.00', 2, 10, codigo);
  };
  const sesionCheckout = (idSesion: number) =>
    unaFila('SP_Pruebas_LeerSesionCheckout', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    });

  it('una tarjeta rechazada responde 402 con los intentos restantes; el quinto cancela la sesión y libera', async () => {
    const { cliente, idSesion } = await sesionConCupon();

    const respuestas = [];
    for (let i = 0; i < 5; i++) {
      respuestas.push(await pagar(app, cliente.token, randomUUID(), TARJETA_RECHAZADA));
    }
    const sexta = await pagar(app, cliente.token, randomUUID(), TARJETA_RECHAZADA);

    expect(respuestas.map((r) => r.status)).toEqual([402, 402, 402, 402, 402]);
    const detalles = respuestas.map((r) =>
      z
        .object({ intentosRestantes: z.number(), sesionCancelada: z.boolean() })
        .parse(leerError(r).detalles),
    );
    expect(detalles.map((d) => d.intentosRestantes)).toEqual([4, 3, 2, 1, 0]);
    expect(detalles.map((d) => d.sesionCancelada)).toEqual([false, false, false, false, true]);
    expect(await sesionCheckout(idSesion)).toEqual({
      Estado: 'Cancelada',
      IntentosRechazados: 5,
      EstadoReserva: 'Liberada',
      EstadoUsoCupon: 'Liberado',
      UsosComprometidosCupon: 0,
    });
    expect(sexta.status).toBe(404);
  });

  it('rechazos simultáneos: nunca pasan de cinco ni cancelan dos veces', async () => {
    const { cliente, idSesion } = await sesionConCupon();

    const estados: number[] = [];
    for (let ronda = 0; ronda < 7; ronda++) {
      const respuestas = await Promise.all(
        Array.from({ length: 3 }, () => pagar(app, cliente.token, randomUUID(), TARJETA_RECHAZADA)),
      );
      estados.push(...respuestas.map((r) => r.status));
    }

    expect(estados.filter((estado) => estado === 402)).toHaveLength(5);
    expect(estados.every((estado) => [402, 409, 404].includes(estado))).toBe(true);
    expect((await intentosDe(idSesion)).filter((i) => i.Estado === 'Rechazado')).toHaveLength(5);
    // Una doble cancelación liberaría el cupón dos veces (el CHECK del contador lo impediría con un error).
    expect(await sesionCheckout(idSesion)).toMatchObject({
      Estado: 'Cancelada',
      IntentosRechazados: 5,
      EstadoUsoCupon: 'Liberado',
      UsosComprometidosCupon: 0,
    });
  });

  it('la misma llave de un rechazo devuelve el mismo 402', async () => {
    const { cliente } = await clienteConSesion();
    const llave = randomUUID();

    const primero = await pagar(app, cliente.token, llave, TARJETA_RECHAZADA);
    const repetido = await pagar(app, cliente.token, llave, TARJETA_RECHAZADA);

    expect([primero.status, repetido.status]).toEqual([402, 402]);
    expect(leerError(repetido).mensaje).toBe(leerError(primero).mensaje);
  });
});

describe('inventario con Idempotency-Key (E5-H03)', () => {
  const entrada = (token: string, idVariante: number, llave: string | null, cantidad = 4) =>
    request(app)
      .post('/api/v1/inventario/entradas')
      .set({ ...comoCliente(token), ...(llave === null ? {} : { 'Idempotency-Key': llave }) })
      .send({ idVariante, cantidad, motivo: 'Compra' });
  const movimiento = z.object({ idMovimientoKardex: z.number(), existenciaResultante: z.number() });

  it('la misma llave devuelve el mismo movimiento sin registrarlo dos veces; otro contenido responde 422', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const { IDVariante } = await varianteVendible('10.00', 0);
    const llave = randomUUID();

    const primera = leerDatos(await entrada(operador.accessToken, IDVariante, llave), movimiento);
    const repetida = leerDatos(await entrada(operador.accessToken, IDVariante, llave), movimiento);
    const otra = await entrada(operador.accessToken, IDVariante, llave, 5);
    const sinLlave = leerDatos(await entrada(operador.accessToken, IDVariante, null), movimiento);

    expect(repetida).toEqual(primera);
    expect(primera.existenciaResultante).toBe(4);
    expect(leerError(otra).codigo).toBe('LLAVE_REUTILIZADA');
    expect(sinLlave.existenciaResultante).toBe(8);
  });

  it('la misma llave en dos ajustes simultáneos registra uno solo', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const { IDVariante } = await varianteVendible('10.00', 10);
    const llave = randomUUID();
    const ajuste = () =>
      request(app)
        .post('/api/v1/inventario/ajustes')
        .set({ ...comoCliente(operador.accessToken), 'Idempotency-Key': llave })
        .send({ idVariante: IDVariante, cantidad: -3, motivo: 'Merma' });

    const respuestas = await Promise.all([ajuste(), ajuste(), ajuste()]);

    const ids = new Set(respuestas.map((r) => leerDatos(r, movimiento).idMovimientoKardex));
    expect(ids.size).toBe(1);
    expect(respuestas.map((r) => leerDatos(r, movimiento).existenciaResultante)).toEqual([7, 7, 7]);
  });
});
