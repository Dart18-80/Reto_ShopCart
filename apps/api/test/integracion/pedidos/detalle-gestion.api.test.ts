import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { TRANSICIONES } from '../../../src/modules/pedidos/pedidos.transiciones.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { metodoEnvio } from '../checkout/apoyo-checkout.js';
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

const detalleGestionSchema = z.object({
  idPedido: z.number(),
  estado: z.string(),
  puedeCancelar: z.boolean(),
  puedeDevolver: z.boolean(),
  transicionesPermitidas: z.array(z.string()),
  cliente: z.object({ idUsuario: z.number(), nombre: z.string(), correo: z.string() }),
  lineas: z.array(
    z.object({
      idDetallePedido: z.number(),
      cantidad: z.number(),
      cantidadDevuelta: z.number(),
      devolvible: z.number(),
    }),
  ),
  historial: z.array(z.object({ estadoNuevo: z.string(), rol: z.string() })),
});

const pedirDetalle = (idPedido: number, token = tokenOperador) =>
  request(app)
    .get(`/api/v1/admin/pedidos/${String(idPedido)}`)
    .set(comoCliente(token));

const detalle = async (idPedido: number, token = tokenOperador) =>
  leerDatos(await pedirDetalle(idPedido, token), detalleGestionSchema);

const cambiar = (idPedido: number, estadoEsperado: string, estadoNuevo: string) =>
  request(app)
    .post(`/api/v1/admin/pedidos/${String(idPedido)}/estado`)
    .set(comoCliente(tokenOperador))
    .send({ estadoEsperado, estadoNuevo });

/** Lo que el endpoint de estado acepta desde ese estado para el rol (el mapa que verifica la prueba de N-08). */
const delMapa = (origen: string, rol: 'Operador' | 'Administrador') =>
  TRANSICIONES.filter((t) => t.origen === origen && t.via === 'Gestion' && t.roles.includes(rol))
    .map((t) => t.destino)
    .sort();

async function entregado() {
  const pagado = await pedidoPagado(app, estandar, { lineas: [{ precio: '40.00', cantidad: 3 }] });
  for (const [esperado, nuevo] of [
    ['Pagado', 'EnPreparacion'],
    ['EnPreparacion', 'Despachado'],
    ['Despachado', 'Entregado'],
  ] as const) {
    expect((await cambiar(pagado.pedido.idPedido, esperado, nuevo)).status).toBe(200);
  }
  return pagado;
}

describe('GET /admin/pedidos/{id}: el detalle para el personal (M8-H01)', () => {
  it('trae el pedido con su cliente, lo que se puede hacer con él y lo devolvible de cada línea', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar, {
      lineas: [{ precio: '25.00', cantidad: 2 }],
    });

    const recibido = await detalle(pedido.idPedido);

    expect(recibido).toMatchObject({
      idPedido: pedido.idPedido,
      estado: 'Pagado',
      puedeCancelar: true,
      puedeDevolver: false,
      transicionesPermitidas: ['EnPreparacion'],
      cliente: { idUsuario: cliente.idUsuario, nombre: 'Cliente de prueba' },
      lineas: [{ cantidad: 2, cantidadDevuelta: 0, devolvible: 2 }],
      historial: [{ estadoNuevo: 'Pagado' }],
    });
    expect(recibido.cliente.correo).toMatch(/@shopcart\.test$/);
  });

  it('las transiciones son las del rol del actor en cada estado del ciclo', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    const ciclo = ['Pagado', 'EnPreparacion', 'Despachado', 'Entregado'] as const;

    for (const [indice, estado] of ciclo.entries()) {
      const operador = await detalle(pedido.idPedido, tokenOperador);
      const admin = await detalle(pedido.idPedido, tokenAdmin);
      expect([estado, [...operador.transicionesPermitidas].sort()]).toEqual([
        estado,
        delMapa(estado, 'Operador'),
      ]);
      expect([...admin.transicionesPermitidas].sort()).toEqual(delMapa(estado, 'Administrador'));
      const siguiente = ciclo[indice + 1];
      if (siguiente !== undefined) await cambiar(pedido.idPedido, estado, siguiente);
    }
  });

  it('un pedido Cancelado no permite ninguna transición, ni cancelar ni devolver', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    await request(app)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/cancelar`)
      .set(comoCliente(tokenOperador))
      .send({ motivo: 'Sin existencia en bodega' });

    expect(await detalle(pedido.idPedido)).toMatchObject({
      estado: 'Cancelado',
      transicionesPermitidas: [],
      puedeCancelar: false,
      puedeDevolver: false,
    });
  });

  it('con el cobro sin confirmar no ofrece avanzar desde Pagado (el SP respondería 50710)', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    await ejecutarSP('SP_Pruebas_PonerPagoEnRevision', {
      IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
    });

    expect(await detalle(pedido.idPedido)).toMatchObject({
      estado: 'Pagado',
      transicionesPermitidas: [],
      puedeCancelar: false,
    });
  });

  it('Entregado se puede devolver; devolvible baja con una devolución parcial y sigue en DevueltoParcial', async () => {
    const { pedido } = await entregado();
    const antes = await detalle(pedido.idPedido);
    const linea = antes.lineas[0];
    if (linea === undefined) throw new Error('El pedido no tiene líneas');

    const devolucion = await request(app)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/devoluciones`)
      .set(comoCliente(tokenOperador))
      .send({
        motivo: 'Talla equivocada',
        lineas: [{ idDetallePedido: linea.idDetallePedido, cantidad: 1 }],
      });
    const despues = await detalle(pedido.idPedido);

    expect(antes).toMatchObject({
      estado: 'Entregado',
      puedeDevolver: true,
      transicionesPermitidas: [],
      lineas: [{ devolvible: 3 }],
    });
    expect(devolucion.status).toBe(201);
    expect(despues).toMatchObject({
      estado: 'DevueltoParcial',
      puedeDevolver: true,
      lineas: [{ cantidadDevuelta: 1, devolvible: 2 }],
    });
  });

  it('fuera del plazo de devolución (N-10) ya no se puede devolver', async () => {
    const { pedido } = await entregado();
    await ejecutarSP('SP_Pruebas_EntregaAntigua', {
      IDPedido: { tipo: sql.Int, valor: pedido.idPedido },
      DiasAtras: { tipo: sql.Int, valor: 31 },
    });

    expect((await detalle(pedido.idPedido)).puedeDevolver).toBe(false);
  });

  it('un Cliente recibe 403 y un pedido inexistente 404', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const delCliente = await pedirDetalle(pedido.idPedido, cliente.token);
    const inexistente = await pedirDetalle(2_000_000_000);

    expect([delCliente.status, leerError(delCliente).codigo]).toEqual([403, 'SIN_PERMISO']);
    expect([inexistente.status, leerError(inexistente).codigo]).toEqual([404, 'NO_ENCONTRADO']);
  });
});

const resumenSchema = z.object({
  datos: z.array(z.object({ idPedido: z.number() })),
  paginacion: z.object({ total: z.number() }),
});

const buscarPorCliente = async (texto: string) =>
  resumenSchema.parse(
    (
      await request(app)
        .get('/api/v1/admin/pedidos')
        .query({ cliente: texto })
        .set(comoCliente(tokenOperador))
    ).body,
  );

async function clienteLlamado(nombre: string) {
  const { cliente, pedido } = await pedidoPagado(app, estandar);
  const perfil = await request(app)
    .patch('/api/v1/usuarios/me')
    .set(comoCliente(cliente.token))
    .send({ nombre });
  expect(perfil.status).toBe(200);
  return { cliente, pedido };
}

describe('GET /admin/pedidos?cliente=: el filtro por nombre o correo (M8-H01)', () => {
  it('encuentra al cliente por su nombre sin tildes ni mayúsculas', async () => {
    const marca = randomUUID().slice(0, 8);
    const { pedido } = await clienteLlamado(`Íñigo Núñez ${marca}`);

    const encontrados = await buscarPorCliente(`INIGO NUNEZ ${marca}`);

    expect(encontrados.datos.map((p) => p.idPedido)).toEqual([pedido.idPedido]);
    expect(encontrados.paginacion.total).toBe(1);
  });

  it('encuentra al cliente por una parte de su correo', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    const perfil = leerDatos(
      await request(app).get('/api/v1/usuarios/me').set(comoCliente(cliente.token)),
      z.object({ correo: z.string() }),
    );
    const parte = perfil.correo.slice('prueba-'.length, 'prueba-'.length + 13).toUpperCase();

    expect((await buscarPorCliente(parte)).datos.map((p) => p.idPedido)).toEqual([pedido.idPedido]);
  });

  it('busca los comodines como texto: «%» no trae todos los pedidos', async () => {
    const marca = randomUUID().slice(0, 8);
    await clienteLlamado(`Cliente ${marca}X`);

    // Sin escapar, los dos encontrarían al cliente: «%» y «_» calzan con la X.
    expect((await buscarPorCliente(`${marca}X`)).paginacion.total).toBe(1);
    expect((await buscarPorCliente(`${marca}%`)).paginacion.total).toBe(0);
    expect((await buscarPorCliente(`${marca}_`)).paginacion.total).toBe(0);
  });

  it('un texto de más de 150 caracteres responde 400', async () => {
    const respuesta = await request(app)
      .get('/api/v1/admin/pedidos')
      .query({ cliente: 'a'.repeat(151) })
      .set(comoCliente(tokenOperador));

    expect([respuesta.status, leerError(respuesta).codigo]).toEqual([400, 'VALIDACION_FALLIDA']);
  });
});
