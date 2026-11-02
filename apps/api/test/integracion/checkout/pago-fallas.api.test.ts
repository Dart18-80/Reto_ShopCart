import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { crearLogger } from '../../../src/shared/observability/index.js';
import type { PasarelaPago } from '../../../src/shared/pasarela/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
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
  reservasDe,
  TARJETA_APROBADA,
} from './apoyo-checkout.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());

let tokenAdmin: string;
let estandar: number;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  estandar = await metodoEnvio(app);
});

async function cambiarSku(idVariante: number, sku: string): Promise<void> {
  const respuesta = await request(app)
    .patch(`/api/v1/admin/variantes/${String(idVariante)}`)
    .set(comoCliente(tokenAdmin))
    .send({ sku });
  expect(respuesta.status).toBe(200);
}

/**
 * TR_Pruebas_FallarDetallePedido hace fallar el pedido de una variante con SKU 'FALLA-…' (al insertar el
 * detalle) y TR_Pruebas_FallarCierreDeCarrito, con 'FALLAFIN-…', al final (al cerrar el carrito).
 */
async function varianteQueFallaAlPedir(prefijo = 'FALLA-'): Promise<number> {
  const { IDVariante } = await varianteVendible('50.00', 10);
  await cambiarSku(IDVariante, `${prefijo}${randomUUID().slice(0, 8)}`);
  return IDVariante;
}

const estadoDeSesion = (idSesion: number) =>
  unaFila<{
    Estado: string;
    IntentosRechazados: number;
    EstadoReserva: string | null;
    EstadoUsoCupon: string | null;
    UsosComprometidosCupon: number | null;
  }>('SP_Pruebas_LeerSesionCheckout', { IDSesionCheckout: { tipo: sql.Int, valor: idSesion } });

const kardexDe = (idVariante: number) =>
  unaFila<{ ExistenciaFisica: number; Movimientos: number }>('SP_Pruebas_LeerKardex', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
  });

async function sesionCon(idVariante: number, cantidad = 1, aplicacion = app) {
  const cliente = await clienteConCarrito(aplicacion, [{ idVariante, cantidad }]);
  const sesion = leerSesionPago(await iniciarPago(aplicacion, cliente, estandar));
  return { cliente, idSesion: sesion.idSesion };
}

/** La pasarela simulada con una operación que siempre falla. */
function pasarelaQueFalla(operacion: 'capturar' | 'anular'): PasarelaPago {
  const real = crearPasarelaSimulada();
  return { ...real, [operacion]: () => Promise.reject(new Error(`${operacion} simulado caído`)) };
}

describe('atomicidad del pedido (E5-H03, RF-06)', () => {
  it('si el pedido falla dentro del SP no queda pedido, detalle, kardex ni cupón confirmado, y se anula la autorización', async () => {
    const { cliente, idSesion } = await sesionCon(await varianteQueFallaAlPedir());
    const llave = randomUUID();

    const respuesta = await pagar(app, cliente.token, llave);

    expect(respuesta.status).toBe(500);
    expect(await pagoDe(idSesion)).toMatchObject({
      Pedidos: 0,
      Detalles: 0,
      SalidasKardex: 0,
      Historial: 0,
      EstadoSesion: 'Activa',
      EstadoCarrito: 'Activo',
      EstadoReserva: 'Activa',
    });
    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Anulado', CodigoRespuesta: 'ERROR_INTERNO' },
    ]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });

  it('la misma llave de un pedido fallido devuelve el mismo error sin volver a cobrar', async () => {
    const { cliente } = await sesionCon(await varianteQueFallaAlPedir());
    const llave = randomUUID();
    await pagar(app, cliente.token, llave);

    const repetida = await pagar(app, cliente.token, llave);

    expect(repetida.status).toBe(500);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });

  it('si además falla la anulación, el intento queda Autorizado sin pedido para la conciliación', async () => {
    const conAnulacionCaida = crearApp(
      dependenciasDePrueba({ pasarela: pasarelaQueFalla('anular') }),
    );
    const { cliente, idSesion } = await sesionCon(
      await varianteQueFallaAlPedir(),
      1,
      conAnulacionCaida,
    );
    const llave = randomUUID();

    const respuesta = await pagar(conAnulacionCaida, cliente.token, llave);

    expect(respuesta.status).toBe(500);
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Autorizado' }]);
    expect((await pagoDe(idSesion)).Pedidos).toBe(0);
    expect(await estadoEnPasarela(llave)).toBe('Autorizada');
  });

  it('si falla la captura, el pedido existe (201) y el intento queda Autorizado para la conciliación', async () => {
    const conCapturaCaida = crearApp(
      dependenciasDePrueba({ pasarela: pasarelaQueFalla('capturar') }),
    );
    const { IDVariante } = await varianteVendible('30.00', 10);
    const { cliente, idSesion } = await sesionCon(IDVariante, 1, conCapturaCaida);
    const llave = randomUUID();

    const respuesta = await pagar(conCapturaCaida, cliente.token, llave);

    expect(respuesta.status).toBe(201);
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Autorizado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Autorizada');
  });
});

describe('atomicidad con la falla al final de la transacción (E5-H03, RF-06)', () => {
  it('se revierten la salida del kardex, la existencia, las reservas, el cupón, la sesión y el carrito', async () => {
    const idVariante = await varianteQueFallaAlPedir('FALLAFIN-');
    const { codigo } = await crearCupon(app, tokenAdmin, { limiteUsosTotal: 3 });
    const cliente = await clienteConCarrito(app, [{ idVariante, cantidad: 2 }]);
    await request(app)
      .put('/api/v1/carrito/cupon')
      .set(comoCliente(cliente.token))
      .send({ codigo });
    const { idSesion } = leerSesionPago(await iniciarPago(app, cliente, estandar));
    const kardexAntes = await kardexDe(idVariante);
    const llave = randomUUID();

    const respuesta = await pagar(app, cliente.token, llave);

    expect(respuesta.status).toBe(500);
    expect(await kardexDe(idVariante)).toEqual(kardexAntes);
    expect(await estadoDeSesion(idSesion)).toMatchObject({
      Estado: 'Activa',
      EstadoReserva: 'Activa',
      EstadoUsoCupon: 'Reservado',
      UsosComprometidosCupon: 1,
    });
    expect(await pagoDe(idSesion)).toMatchObject({
      Pedidos: 0,
      Historial: 0,
      EstadoCarrito: 'Activo',
    });
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Anulado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });
});

describe('retomar con la misma llave (E5-H03, 01 §6.2)', () => {
  it('pedido sin capturar: vencido el arrendamiento, el reintento captura y responde 200 con el mismo pedido', async () => {
    const conCapturaCaida = crearApp(
      dependenciasDePrueba({ pasarela: pasarelaQueFalla('capturar') }),
    );
    const { IDVariante } = await varianteVendible('30.00', 10);
    const { cliente, idSesion } = await sesionCon(IDVariante, 1, conCapturaCaida);
    const llave = randomUUID();
    const primero = leerPedido(await pagar(conCapturaCaida, cliente.token, llave));
    const [intento] = await intentosDe(idSesion);
    await moverArrendamiento(intento?.IDIntentoPago ?? '0', -1);

    const reintento = await pagar(app, cliente.token, llave);

    expect(reintento.status).toBe(200);
    expect(leerPedido(reintento).idPedido).toBe(primero.idPedido);
    expect(await intentosDe(idSesion)).toMatchObject([{ Estado: 'Capturado' }]);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
  });

  it('autorizado sin pedido: vencido el arrendamiento, el reintento crea el pedido con la misma autorización', async () => {
    const conAnulacionCaida = crearApp(
      dependenciasDePrueba({ pasarela: pasarelaQueFalla('anular') }),
    );
    const idVariante = await varianteQueFallaAlPedir();
    const { cliente, idSesion } = await sesionCon(idVariante, 1, conAnulacionCaida);
    const llave = randomUUID();
    await pagar(conAnulacionCaida, cliente.token, llave);
    const [autorizado] = await intentosDe(idSesion);
    await cambiarSku(idVariante, `SANA-${randomUUID().slice(0, 8)}`);
    await moverArrendamiento(autorizado?.IDIntentoPago ?? '0', -1);

    const reintento = await pagar(app, cliente.token, llave);

    expect(reintento.status).toBe(201);
    expect(await intentosDe(idSesion)).toMatchObject([
      { Estado: 'Capturado', IDTransaccionPasarela: autorizado?.IDTransaccionPasarela },
    ]);
    expect(await estadoEnPasarela(llave)).toBe('Capturada');
    expect((await pagoDe(idSesion)).Pedidos).toBe(1);
  });
});

describe('reservas vencidas (E5-H03, N-06)', () => {
  const vencerReservas = (idSesion: number) =>
    ejecutarSP('SP_Pruebas_VencerReservasSesion', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    });

  it('si la reserva venció pero hay existencia, el pedido se crea igual', async () => {
    const { IDVariante } = await varianteVendible('30.00', 5);
    const { cliente, idSesion } = await sesionCon(IDVariante, 2);
    await vencerReservas(idSesion);

    const respuesta = await pagar(app, cliente.token, randomUUID());

    expect(respuesta.status).toBe(201);
    expect((await pagoDe(idSesion)).SalidasKardex).toBe(1);
    // Se renovó y se consumió en su misma fila: SP_Inventario_ReservarExistencia no inserta otra.
    expect(await reservasDe(idSesion)).toEqual([{ IDVariante, Cantidad: 2, Estado: 'Consumida' }]);
  });

  it('si la reserva venció y otro tomó la existencia, 409 STOCK_INSUFICIENTE sin cobro', async () => {
    const { IDVariante } = await varianteVendible('30.00', 1);
    const primero = await sesionCon(IDVariante, 1);
    await vencerReservas(primero.idSesion);
    await sesionCon(IDVariante, 1);
    const llave = randomUUID();

    const respuesta = await pagar(app, primero.cliente.token, llave);

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: IDVariante, cantidad: 1, disponible: 0 }],
    });
    expect((await pagoDe(primero.idSesion)).Pedidos).toBe(0);
    expect(await estadoEnPasarela(llave)).toBe('Anulada');
  });
});

describe('datos de la tarjeta (E5-H02, N-03)', () => {
  it('el número completo y el CVV nunca aparecen en los logs ni en la respuesta', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const conLogs = crearApp(
      dependenciasDePrueba({ logger: crearLogger({ nivel: 'debug', destino }) }),
    );
    const { IDVariante } = await varianteVendible('30.00', 10);
    const { cliente } = await sesionCon(IDVariante, 1, conLogs);

    const respuesta = await pagar(conLogs, cliente.token, randomUUID());

    const pedido = leerPedido(respuesta);
    const log = lineas.join('');
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(TARJETA_APROBADA);
    expect(log).not.toMatch(/"cvv":"731"/);
    expect(JSON.stringify(respuesta.body)).not.toContain(TARJETA_APROBADA);
    expect(pedido.tarjeta).toEqual({ marca: 'Visa', ultimosDigitos: '4242' });
  });

  it('un cuerpo inválido responde 400 por campo sin repetir el número ni el CVV, ni en los logs', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const conLogs = crearApp(
      dependenciasDePrueba({ logger: crearLogger({ nivel: 'debug', destino }) }),
    );
    const { IDVariante } = await varianteVendible('30.00', 10);
    const { cliente } = await sesionCon(IDVariante, 1, conLogs);
    const numero = '42424242x4242424';

    const respuesta = await request(conLogs)
      .post('/api/v1/checkout/sesion/pagos')
      .set({ ...comoCliente(cliente.token), 'Idempotency-Key': randomUUID() })
      .send({
        numeroTarjeta: numero,
        mesVencimiento: 13,
        anioVencimiento: 2030,
        cvv: '98',
        extra: 1,
      });

    expect(respuesta.status).toBe(400);
    const campos = z
      .object({ errores: z.array(z.object({ campo: z.string() })) })
      .parse(leerError(respuesta).detalles)
      .errores.map((e) => e.campo);
    expect(campos).toEqual(
      expect.arrayContaining(['body.numeroTarjeta', 'body.mesVencimiento', 'body.cvv']),
    );
    const visible = JSON.stringify(respuesta.body) + lineas.join('');
    expect(visible).not.toContain(numero);
    expect(visible).not.toMatch(/"98"/);
  });
});
