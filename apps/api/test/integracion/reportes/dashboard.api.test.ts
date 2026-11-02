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
import { comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import { clienteConCarrito, metodoEnvio } from '../checkout/apoyo-checkout.js';
import { unaFila } from '../datos-de-prueba.js';
import { moverFechaPedido, pedidoPagado } from '../pedidos/apoyo-pedidos.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let tokenAdmin: string;
let tokenOperador: string;
let estandar: number;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
  estandar = await metodoEnvio(app);
});

const dashboard = (ruta: string, token = tokenAdmin) =>
  request(app).get(`/api/v1/dashboard${ruta}`).set(comoCliente(token));

const datosDe = async (ruta: string): Promise<unknown> =>
  z.object({ datos: z.unknown() }).parse((await dashboard(ruta)).body).datos;

const resumenSchema = z.object({
  ventas: z.string(),
  pedidos: z.number(),
  ticketPromedio: z.string(),
  unidades: z.number(),
  devoluciones: z.string(),
  envio: z.string(),
});
const ventasSchema = z.array(
  z.object({ periodo: z.string(), ventas: z.string(), pedidos: z.number() }),
);

/** Un pedido pagado (precio, cantidad) en un día de Guatemala dado; devuelve también su detalle de línea. */
async function pedidoEnFecha(fechaLocal: string, precio = '50.00', cantidad = 2) {
  const resultado = await pedidoPagado(app, estandar, { lineas: [{ precio, cantidad }] });
  await moverFechaPedido(resultado.pedido.idPedido, fechaLocal);
  return resultado;
}

const operar = (ruta: string, cuerpo: object) =>
  request(app).post(`/api/v1/admin/pedidos${ruta}`).set(comoCliente(tokenOperador)).send(cuerpo);

async function entregar(idPedido: number) {
  for (const [estadoEsperado, estadoNuevo] of [
    ['Pagado', 'EnPreparacion'],
    ['EnPreparacion', 'Despachado'],
    ['Despachado', 'Entregado'],
  ] as const) {
    await operar(`/${String(idPedido)}/estado`, { estadoEsperado, estadoNuevo });
  }
}

/** Devuelve 1 unidad de la primera línea y lleva la devolución al instante UTC dado. */
async function devolucionEn(
  cliente: { token: string },
  idPedido: number,
  fechaUtc: string,
): Promise<string> {
  const { lineas } = leerDatos(
    await request(app)
      .get(`/api/v1/pedidos/${String(idPedido)}`)
      .set(comoCliente(cliente.token)),
    z.object({ lineas: z.array(z.object({ idDetallePedido: z.number() })) }),
  );
  const respuesta = await operar(`/${String(idPedido)}/devoluciones`, {
    motivo: 'Devolución de prueba',
    lineas: [{ idDetallePedido: lineas[0]?.idDetallePedido ?? 0, cantidad: 1 }],
  });
  const { devolucion } = leerDatos(
    respuesta,
    z.object({ devolucion: z.object({ idDevolucion: z.number(), montoReembolso: z.string() }) }),
  );
  await ejecutarSP('SP_Pruebas_MoverFechaDevolucion', {
    IDDevolucion: { tipo: sql.Int, valor: devolucion.idDevolucion },
    FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(fechaUtc) },
  });
  return devolucion.montoReembolso;
}

describe('dashboard (E7-H01, RF-08, N-11)', () => {
  it('el resumen cuenta pedidos no cancelados en su día de pago: productos con IVA sin envío, envío aparte', async () => {
    const dia = '2001-05-10';
    const vigente = await pedidoEnFecha(dia, '50.00', 2);
    const cancelado = await pedidoEnFecha(dia, '80.00', 1);
    await request(app)
      .post(`/api/v1/pedidos/${String(cancelado.pedido.idPedido)}/cancelar`)
      .set(comoCliente(cancelado.cliente.token))
      .send({ motivo: 'Ya no lo quiero' });

    const resumen = leerDatos(await dashboard(`/resumen?desde=${dia}&hasta=${dia}`), resumenSchema);

    expect(resumen).toMatchObject({
      ventas: '100.00',
      pedidos: 1,
      ticketPromedio: '100.00',
      unidades: 2,
      devoluciones: '0.00',
      envio: vigente.pedido.costoEnvio,
    });
  });

  it('las devoluciones se restan en su propio día de Guatemala (05:59 UTC → día anterior; 06:00 → mismo día)', async () => {
    const venta = await pedidoEnFecha('2002-04-10', '40.00', 3);
    await entregar(venta.pedido.idPedido);
    const primera = await devolucionEn(
      venta.cliente,
      venta.pedido.idPedido,
      '2002-04-15T05:59:00Z',
    );
    const segunda = await devolucionEn(
      venta.cliente,
      venta.pedido.idPedido,
      '2002-04-15T06:00:00Z',
    );

    const dias = ventasSchema.parse(
      await datosDe('/ventas?agrupacion=dia&desde=2002-04-10&hasta=2002-04-15'),
    );

    expect(dias).toEqual([
      { periodo: '2002-04-10', ventas: '120.00', pedidos: 1 },
      { periodo: '2002-04-14', ventas: `-${primera}`, pedidos: 0 },
      { periodo: '2002-04-15', ventas: `-${segunda}`, pedidos: 0 },
    ]);
    const resumenDelDia = leerDatos(
      await dashboard('/resumen?desde=2002-04-10&hasta=2002-04-10'),
      resumenSchema,
    );
    expect(resumenDelDia.ventas).toBe('120.00');
  });

  it('agrupa por semana (desde el lunes) y por mes', async () => {
    await pedidoEnFecha('2003-06-02', '10.00', 1);
    await pedidoEnFecha('2003-06-08', '20.00', 1);
    await pedidoEnFecha('2003-06-09', '30.00', 1);
    const rango = 'desde=2003-06-01&hasta=2003-06-30';

    const semanas = ventasSchema.parse(await datosDe(`/ventas?agrupacion=semana&${rango}`));
    const meses = ventasSchema.parse(await datosDe(`/ventas?agrupacion=mes&${rango}`));

    expect(semanas).toEqual([
      { periodo: '2003-06-02', ventas: '30.00', pedidos: 2 },
      { periodo: '2003-06-09', ventas: '30.00', pedidos: 1 },
    ]);
    expect(meses).toEqual([{ periodo: '2003-06-01', ventas: '60.00', pedidos: 3 }]);
  });

  it('ventas por categoría y top productos del periodo', async () => {
    const dia = '2004-02-11';
    const { variantes } = await pedidoEnFecha(dia, '15.00', 4);
    await pedidoEnFecha(dia, '90.00', 1);
    const rango = `desde=${dia}&hasta=${dia}`;

    const categorias = z
      .array(z.object({ idCategoria: z.number(), unidades: z.number(), ventas: z.string() }))
      .parse(await datosDe(`/ventas-por-categoria?${rango}`));
    const top = z
      .array(z.object({ idProducto: z.number(), unidades: z.number(), ventas: z.string() }))
      .parse(await datosDe(`/top-productos?${rango}`));

    expect(categorias.reduce((suma, c) => suma + c.unidades, 0)).toBe(5);
    expect(top.map((p) => [p.unidades, p.ventas])).toEqual([
      [4, '60.00'],
      [1, '90.00'],
    ]);
    expect(variantes).toHaveLength(1);
  });

  it('cuenta un carrito abandonado en el día de su última actividad, con su monto potencial', async () => {
    const { IDVariante } = await varianteVendible('25.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 2 }]);
    const carrito = await unaFila<{ IDCarrito: number }>('SP_Pruebas_LeerCarritos', {
      IDUsuario: { tipo: sql.Int, valor: cliente.idUsuario },
    });
    await ejecutarSP('SP_Pruebas_EnvejecerCarrito', {
      IDCarrito: { tipo: sql.Int, valor: carrito.IDCarrito },
      Dias: { tipo: sql.Int, valor: 3 },
    });
    const { FechaLocal: dia } = await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
      FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    });

    const lista = z
      .object({
        datos: z.array(
          z.object({ idCarrito: z.number(), unidades: z.number(), montoPotencial: z.string() }),
        ),
      })
      .parse((await dashboard(`/carritos-abandonados?desde=${dia}&hasta=${dia}&tamano=100`)).body);

    expect(lista.datos).toContainEqual({
      idCarrito: carrito.IDCarrito,
      unidades: 2,
      montoPotencial: '50.00',
    });
  });

  it('valida el rango y la agrupación (400) y es solo para el Admin (403)', async () => {
    const rango = await dashboard('/resumen?desde=2026-02-01&hasta=2026-01-01');
    const agrupacion = await dashboard('/ventas?agrupacion=anio');
    const operador = await dashboard('/resumen', tokenOperador);

    expect([rango.status, agrupacion.status, operador.status]).toEqual([400, 400, 403]);
  });

  it('cada reporte responde en menos de 1 s (RNF-1)', async () => {
    for (const ruta of [
      '/resumen',
      '/ventas?agrupacion=dia',
      '/ventas?agrupacion=mes',
      '/ventas-por-categoria',
      '/top-productos',
      '/carritos-abandonados',
    ]) {
      const inicio = performance.now();
      const respuesta = await dashboard(ruta);

      expect(respuesta.status, ruta).toBe(200);
      expect(performance.now() - inicio, ruta).toBeLessThan(1000);
    }
  });
});
