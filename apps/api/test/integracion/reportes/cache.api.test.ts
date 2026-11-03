import sql from 'mssql';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearCacheRedis } from '../../../src/shared/adapters/cache-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { agregar, comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import { clienteConCarrito, metodoEnvio } from '../checkout/apoyo-checkout.js';
import { unaFila } from '../datos-de-prueba.js';
import { moverFechaPedido, pedidoPagado } from '../pedidos/apoyo-pedidos.js';

usarBaseDePruebas();

// E7-H04 (A-11): dos "réplicas" con la caché de Redis real (la base de pruebas de Redis) comparten la versión.
const redis = crearClienteRedis(cargarConfiguracion(process.env).redis);
const cache = crearCacheRedis(redis, pino({ level: 'silent' }));
const replica1 = crearApp(dependenciasDePrueba({ cache, instancia: 'api-1' }));
const replica2 = crearApp(dependenciasDePrueba({ cache, instancia: 'api-2' }));
let tokenAdmin: string;
let tokenOperador: string;
let estandar: number;

beforeAll(async () => {
  await redis.connect();
  tokenAdmin = leerSesion(
    await iniciarSesion(replica1, 'admin@shopcart.gt', 'Admin2026!'),
  ).accessToken;
  tokenOperador = leerSesion(
    await iniciarSesion(replica1, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  estandar = await metodoEnvio(replica1);
});

afterAll(() => {
  redis.disconnect();
});

// Un año propio por corrida: repetir el archivo sobre la misma base no se cruza con lo que dejó la anterior.
const ANIO = String(1900 + Math.floor(Math.random() * 50));
const enElAnio = (mesDia: string): string => `${ANIO}-${mesDia}`;

const resumenSchema = z.object({
  pedidos: z.number(),
  ventas: z.string(),
  devoluciones: z.string(),
});
const carritosSchema = z.array(
  z.object({ idCarrito: z.number(), unidades: z.number(), montoPotencial: z.string() }),
);

const resumenDelDia = async (app: typeof replica1, dia: string) =>
  leerDatos(
    await request(app)
      .get(`/api/v1/dashboard/resumen?desde=${dia}&hasta=${dia}`)
      .set(comoCliente(tokenAdmin)),
    resumenSchema,
  );

async function pedidoEnFecha(dia: string, app = replica2) {
  const resultado = await pedidoPagado(app, estandar, {
    lineas: [{ precio: '50.00', cantidad: 2 }],
  });
  await moverFechaPedido(resultado.pedido.idPedido, dia);
  return resultado;
}

describe('caché de reportes con invalidación por versión (E7-H04, A-11)', () => {
  it('la segunda consulta sale de la caché: un cambio que no pasa por un servicio no se ve', async () => {
    const dia = enElAnio('03-01');
    const { pedido } = await pedidoEnFecha(enElAnio('03-02'));
    const antes = await resumenDelDia(replica1, dia);

    // Mover la fecha directo en la base no invalida: la caché todavía responde lo anterior.
    await moverFechaPedido(pedido.idPedido, dia);
    const desdeCache = await resumenDelDia(replica1, dia);

    expect(antes.pedidos).toBe(0);
    expect(desdeCache).toEqual(antes);
  });

  it('un cambio en un carrito no invalida los reportes de ventas (dominios separados)', async () => {
    const dia = enElAnio('03-03');
    const { pedido } = await pedidoEnFecha(enElAnio('03-04'));
    const ventasDelDia = async () =>
      leerDatos(
        await request(replica1)
          .get(`/api/v1/dashboard/ventas-por-categoria?desde=${dia}&hasta=${dia}`)
          .set(comoCliente(tokenAdmin)),
        z.array(z.object({ ventas: z.string() })),
      );
    const antes = await ventasDelDia();
    // El pedido se mueve al día directo en la base (sin invalidar) y después se toca un carrito: solo invalida
    // los carritos, así el reporte de ventas sigue saliendo de la caché.
    await moverFechaPedido(pedido.idPedido, dia);
    const { IDVariante } = await varianteVendible('5.00', 5);
    const cliente = await clienteConCarrito(replica2, [{ idVariante: IDVariante, cantidad: 1 }]);
    await agregar(replica2, comoCliente(cliente.token), IDVariante);

    expect(antes).toEqual([]);
    expect(await ventasDelDia()).toEqual([]);
  });

  it('crear un pedido en una réplica se ve de inmediato en el reporte de la otra', async () => {
    const dia = enElAnio('03-05');
    expect((await resumenDelDia(replica1, dia)).pedidos).toBe(0);

    // El pedido se crea por la réplica 2 (invalida); moverlo de día no invalida, pero la versión ya cambió.
    await pedidoEnFecha(dia, replica2);

    expect((await resumenDelDia(replica1, dia)).pedidos).toBe(1);
  });

  it('cancelar un pedido se ve en el reporte', async () => {
    const dia = enElAnio('03-08');
    const { cliente, pedido } = await pedidoEnFecha(dia);
    expect((await resumenDelDia(replica1, dia)).pedidos).toBe(1);

    await request(replica2)
      .post(`/api/v1/pedidos/${String(pedido.idPedido)}/cancelar`)
      .set(comoCliente(cliente.token))
      .send({ motivo: 'Ya no lo necesito' });

    expect((await resumenDelDia(replica1, dia)).pedidos).toBe(0);
  });

  it('una devolución se ve en el reporte', async () => {
    const { cliente, pedido } = await pedidoPagado(replica2, estandar, {
      lineas: [{ precio: '50.00', cantidad: 2 }],
    });
    for (const [estadoEsperado, estadoNuevo] of [
      ['Pagado', 'EnPreparacion'],
      ['EnPreparacion', 'Despachado'],
      ['Despachado', 'Entregado'],
    ] as const) {
      await request(replica2)
        .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/estado`)
        .set(comoCliente(tokenOperador))
        .send({ estadoEsperado, estadoNuevo });
    }
    const { lineas } = leerDatos(
      await request(replica2)
        .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
        .set(comoCliente(cliente.token)),
      z.object({ lineas: z.array(z.object({ idDetallePedido: z.number() })) }),
    );
    // Un día propio: otros archivos registran devoluciones hoy en paralelo. Registrar la devolución invalida; moverla
    // a ese día directo en la base no, así que el reporte solo la ve si la invalidación funcionó.
    const dia = enElAnio('03-10');
    expect(Number((await resumenDelDia(replica1, dia)).devoluciones)).toBe(0);

    const devolucion = await request(replica2)
      .post(`/api/v1/admin/pedidos/${String(pedido.idPedido)}/devoluciones`)
      .set(comoCliente(tokenOperador))
      .send({
        motivo: 'Talla equivocada',
        lineas: [{ idDetallePedido: lineas[0]?.idDetallePedido, cantidad: 1 }],
      });
    const { devolucion: registrada } = leerDatos(
      devolucion,
      z.object({ devolucion: z.object({ idDevolucion: z.number() }) }),
    );
    await ejecutarSP('SP_Pruebas_MoverFechaDevolucion', {
      IDDevolucion: { tipo: sql.Int, valor: registrada.idDevolucion },
      FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(`${dia}T18:00:00Z`) },
    });

    expect(Number((await resumenDelDia(replica1, dia)).devoluciones)).toBeCloseTo(50, 2);
  });

  it('tocar un carrito abandonado o cambiar el precio de su variante se ve en los carritos abandonados', async () => {
    const { IDVariante } = await varianteVendible('25.00', 10);
    const cliente = await clienteConCarrito(replica2, [{ idVariante: IDVariante, cantidad: 2 }]);
    const { IDCarrito } = await unaFila<{ IDCarrito: number }>('SP_Pruebas_LeerCarritos', {
      IDUsuario: { tipo: sql.Int, valor: cliente.idUsuario },
    });
    await ejecutarSP('SP_Pruebas_EnvejecerCarrito', {
      IDCarrito: { tipo: sql.Int, valor: IDCarrito },
      Dias: { tipo: sql.Int, valor: 3 },
    });
    const { FechaLocal: dia } = await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
      FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    });
    const abandonados = async () =>
      leerDatos(
        await request(replica1)
          .get(`/api/v1/dashboard/carritos-abandonados?desde=${dia}&hasta=${dia}&tamano=100`)
          .set(comoCliente(tokenAdmin)),
        carritosSchema,
      ).find((c) => c.idCarrito === IDCarrito);
    // Invalida antes de la primera lectura: el carrito se envejeció directo en la base.
    await request(replica2)
      .put(`/api/v1/admin/variantes/${String(IDVariante)}/precio`)
      .set(comoCliente(tokenAdmin))
      .send({ precio: '25.50' });
    expect(await abandonados()).toMatchObject({ unidades: 2, montoPotencial: '51.00' });

    await request(replica2)
      .put(`/api/v1/admin/variantes/${String(IDVariante)}/precio`)
      .set(comoCliente(tokenAdmin))
      .send({ precio: '30.00' });
    const conPrecioNuevo = await abandonados();
    await agregar(replica2, comoCliente(cliente.token), IDVariante);
    const trasTocarlo = await abandonados();

    expect(conPrecioNuevo).toMatchObject({ montoPotencial: '60.00' });
    expect(trasTocarlo).toBeUndefined();
  });

  it('con Redis caído el reporte responde igual, desde la base', async () => {
    const caido = crearClienteRedis({
      ...cargarConfiguracion(process.env).redis,
      puerto: 1,
    });
    const sinRedis = crearApp(
      dependenciasDePrueba({ cache: crearCacheRedis(caido, pino({ level: 'silent' })) }),
    );
    const dia = enElAnio('03-12');
    await pedidoEnFecha(dia);

    const respuesta = await request(sinRedis)
      .get(`/api/v1/dashboard/resumen?desde=${dia}&hasta=${dia}`)
      .set(comoCliente(tokenAdmin));
    caido.disconnect();

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, resumenSchema)).toEqual(await resumenDelDia(replica1, dia));
  });
});
