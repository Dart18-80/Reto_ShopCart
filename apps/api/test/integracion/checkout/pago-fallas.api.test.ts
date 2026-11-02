import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
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
import {
  clienteConCarrito,
  estadoEnPasarela,
  iniciarPago,
  intentosDe,
  leerPedido,
  leerSesionPago,
  metodoEnvio,
  pagar,
  pagoDe,
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

/** TR_Pruebas_FallarDetallePedido hace fallar el pedido de una variante con SKU 'FALLA-…'. */
async function varianteQueFallaAlPedir(): Promise<number> {
  const { IDVariante } = await varianteVendible('50.00', 10);
  await request(app)
    .patch(`/api/v1/admin/variantes/${String(IDVariante)}`)
    .set(comoCliente(tokenAdmin))
    .send({ sku: `FALLA-${randomUUID().slice(0, 8)}` });
  return IDVariante;
}

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
});
