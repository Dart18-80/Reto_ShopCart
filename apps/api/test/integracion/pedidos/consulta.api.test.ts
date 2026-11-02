import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { metodoEnvio } from '../checkout/apoyo-checkout.js';
import { moverFechaPedido, pedidoPagado } from './apoyo-pedidos.js';

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

const resumenSchema = z.object({
  idPedido: z.number(),
  numeroPedido: z.string(),
  estado: z.string(),
  total: z.string(),
  articulos: z.number(),
  fechaPagoLocal: z.string(),
});
const paginaSchema = <T extends z.ZodType>(fila: T) =>
  z.object({
    datos: z.array(fila),
    paginacion: z.object({ pagina: z.number(), tamano: z.number(), total: z.number() }),
  });
const gestionSchema = resumenSchema.extend({
  cliente: z.object({ idUsuario: z.number(), nombre: z.string(), correo: z.string() }),
});

const misPedidos = (token: string, consulta = '') =>
  request(app).get(`/api/v1/pedidos${consulta}`).set(comoCliente(token));
const gestion = (token: string, consulta: string) =>
  request(app).get(`/api/v1/admin/pedidos?${consulta}`).set(comoCliente(token));

describe('pedidos del cliente (E6-H01, RF-01)', () => {
  it('lista solo los propios, los más recientes primero y paginados', async () => {
    const { cliente, pedido: primero } = await pedidoPagado(app, estandar);
    const { pedido: segundo } = await pedidoPagado(app, estandar, { cliente });
    await pedidoPagado(app, estandar);

    const respuesta = paginaSchema(resumenSchema).parse(
      (await misPedidos(cliente.token, '?tamano=1')).body,
    );

    expect(respuesta.paginacion).toMatchObject({ pagina: 1, tamano: 1, total: 2 });
    expect(respuesta.datos).toEqual([
      expect.objectContaining({ idPedido: segundo.idPedido, estado: 'Pagado', articulos: 2 }),
    ]);
    const pagina2 = paginaSchema(resumenSchema).parse(
      (await misPedidos(cliente.token, '?tamano=1&pagina=2')).body,
    );
    expect(pagina2.datos.map((p) => p.idPedido)).toEqual([primero.idPedido]);
  });

  it('el detalle trae las líneas con lo devuelto y el historial (ninguno) → Pagado', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const detalle = leerDatos(
      await request(app)
        .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
        .set(comoCliente(cliente.token)),
      z.object({
        montoReembolsado: z.string(),
        lineas: z.array(z.object({ idDetallePedido: z.number(), cantidadDevuelta: z.number() })),
        historial: z.array(
          z.looseObject({ estadoAnterior: z.string().nullable(), estadoNuevo: z.string() }),
        ),
      }),
    );

    expect(detalle.montoReembolsado).toBe('0.00');
    expect(detalle.lineas).toEqual([
      { idDetallePedido: expect.any(Number) as number, cantidadDevuelta: 0 },
    ]);
    expect(detalle.historial).toEqual([
      expect.objectContaining({ estadoAnterior: null, estadoNuevo: 'Pagado', rol: 'Cliente' }),
    ]);
  });

  it('el pedido de otro cliente responde 404, igual que uno inexistente', async () => {
    const { pedido } = await pedidoPagado(app, estandar);
    const { cliente: otro } = await pedidoPagado(app, estandar);

    const ajeno = await request(app)
      .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
      .set(comoCliente(otro.token));
    const inexistente = await request(app)
      .get('/api/v1/pedidos/2147483647')
      .set(comoCliente(otro.token));

    expect([ajeno.status, inexistente.status]).toEqual([404, 404]);
    const sinRequestId = ({ codigo, mensaje }: { codigo: string; mensaje: string }) => ({
      codigo,
      mensaje,
    });
    expect(sinRequestId(leerError(ajeno))).toEqual(sinRequestId(leerError(inexistente)));
    const propios = paginaSchema(resumenSchema).parse((await misPedidos(otro.token)).body);
    expect(propios.datos.map((p) => p.idPedido)).not.toContain(pedido.idPedido);
  });

  it('solo el Cliente tiene "mis pedidos"; un Operador recibe 403', async () => {
    expect((await misPedidos(tokenOperador)).status).toBe(403);
  });
});

describe('gestión de pedidos (E6-H01, RF-07)', () => {
  it('filtra por cliente y por estado, con el cliente de cada pedido', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);

    const delCliente = paginaSchema(gestionSchema).parse(
      (await gestion(tokenOperador, `idCliente=${String(cliente.idUsuario)}`)).body,
    );
    const entregados = paginaSchema(gestionSchema).parse(
      (await gestion(tokenAdmin, `idCliente=${String(cliente.idUsuario)}&estado=Entregado`)).body,
    );

    expect(delCliente.datos).toEqual([
      expect.objectContaining({
        idPedido: pedido.idPedido,
        estado: 'Pagado',
        cliente: expect.objectContaining({ idUsuario: cliente.idUsuario }) as unknown,
      }),
    ]);
    expect(entregados.paginacion.total).toBe(0);
  });

  it('el rango de fechas usa FechaPagoLocal (días de Guatemala), con los extremos incluidos', async () => {
    const { cliente, pedido } = await pedidoPagado(app, estandar);
    await moverFechaPedido(pedido.idPedido, '2001-03-10');
    const filtro = (desde: string, hasta: string) =>
      gestion(
        tokenOperador,
        `idCliente=${String(cliente.idUsuario)}&desde=${desde}&hasta=${hasta}`,
      );

    const dentro = paginaSchema(gestionSchema).parse(
      (await filtro('2001-03-10', '2001-03-10')).body,
    );
    const despues = paginaSchema(gestionSchema).parse(
      (await filtro('2001-03-11', '2001-03-31')).body,
    );

    expect(dentro.datos.map((p) => [p.idPedido, p.fechaPagoLocal])).toEqual([
      [pedido.idPedido, '2001-03-10'],
    ]);
    expect(despues.paginacion.total).toBe(0);
  });

  it('valida los filtros: estado desconocido o rango invertido → 400', async () => {
    const estado = await gestion(tokenOperador, 'estado=Perdido');
    const rango = await gestion(tokenOperador, 'desde=2026-02-01&hasta=2026-01-01');

    expect([estado.status, rango.status]).toEqual([400, 400]);
  });

  it('un Cliente no entra a la gestión (403)', async () => {
    const { cliente } = await pedidoPagado(app, estandar);

    expect((await gestion(cliente.token, '')).status).toBe(403);
  });

  it('el listado de gestión responde en menos de 1 s (RNF-1)', async () => {
    const inicio = performance.now();
    const respuesta = await gestion(tokenAdmin, 'tamano=100');
    const duracion = performance.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(duracion).toBeLessThan(1000);
  });
});

describe('el pedido conserva sus precios (RF-02)', () => {
  const detalleSchema = z.object({
    datos: z.object({
      subtotal: z.string(),
      total: z.string(),
      lineas: z.array(z.object({ precioUnitario: z.string(), totalLinea: z.string() })),
    }),
  });

  it('un cambio de precio posterior no altera el monto de un pedido ya realizado', async () => {
    const { cliente, pedido, variantes } = await pedidoPagado(app, estandar, {
      lineas: [{ precio: '50.00', cantidad: 2 }],
    });
    const idVariante = variantes[0]?.idVariante ?? 0;
    const antes = detalleSchema.parse(
      (
        await request(app)
          .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
          .set(comoCliente(cliente.token))
      ).body,
    );

    const cambio = await request(app)
      .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
      .set(comoCliente(tokenAdmin))
      .send({ precio: '80.00' });
    const despues = detalleSchema.parse(
      (
        await request(app)
          .get(`/api/v1/pedidos/${String(pedido.idPedido)}`)
          .set(comoCliente(cliente.token))
      ).body,
    );

    expect(cambio.status).toBe(200);
    expect(despues).toEqual(antes);
    expect(despues.datos.lineas).toMatchObject([{ precioUnitario: '50.00', totalLinea: '100.00' }]);
  });
});
