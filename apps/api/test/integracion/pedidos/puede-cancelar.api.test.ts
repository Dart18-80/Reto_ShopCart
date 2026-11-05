import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { metodoEnvio } from '../checkout/apoyo-checkout.js';
import { pedidoPagado } from './apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenOperador: string;
let estandar: number;

beforeAll(async () => {
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  estandar = await metodoEnvio(app);
});

const puedeCancelarSchema = z.object({ estado: z.string(), puedeCancelar: z.boolean() });

const detalle = async (idPedido: number, token: string) =>
  leerDatos(
    await request(app)
      .get(`/api/v1/pedidos/${String(idPedido)}`)
      .set(comoCliente(token)),
    puedeCancelarSchema,
  );

const cambiar = (idPedido: number, estadoEsperado: string, estadoNuevo: string) =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/estado`)
    .set(comoCliente(tokenOperador))
    .send({ estadoEsperado, estadoNuevo });

describe('puedeCancelar en el detalle del pedido (M5-H01, N-08, N-09)', () => {
  it('un pedido Pagado se puede cancelar', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    expect(await detalle(pedido.idPedido, cliente.token)).toEqual({
      estado: 'Pagado',
      puedeCancelar: true,
    });
  });

  it('En preparación todavía se puede cancelar; despachado ya no', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    expect((await cambiar(pedido.idPedido, 'Pagado', 'EnPreparacion')).status).toBe(200);
    expect((await detalle(pedido.idPedido, cliente.token)).puedeCancelar).toBe(true);

    expect((await cambiar(pedido.idPedido, 'EnPreparacion', 'Despachado')).status).toBe(200);
    expect(await detalle(pedido.idPedido, cliente.token)).toEqual({
      estado: 'Despachado',
      puedeCancelar: false,
    });
  });

  it('un pedido cancelado ya no se puede cancelar', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await request(app)
      .post(`/api/v1/pedidos/${String(pedido.idPedido)}/cancelar`)
      .set(comoCliente(cliente.token))
      .send({ motivo: 'Ya no lo necesito' });

    expect(await detalle(pedido.idPedido, cliente.token)).toEqual({
      estado: 'Cancelado',
      puedeCancelar: false,
    });
  });

  it('con el pago en verificación no se puede cancelar (el SP respondería 50706)', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await ejecutarSP('SP_Pruebas_PonerPagoEnRevision', {
      IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
    });

    expect(await detalle(pedido.idPedido, cliente.token)).toEqual({
      estado: 'Pagado',
      puedeCancelar: false,
    });
  });
});
