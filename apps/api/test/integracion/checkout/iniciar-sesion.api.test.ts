import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  comoCliente,
  comoInvitado,
  leerCarrito,
  quitarLinea,
  varianteVendible,
  verCarrito,
} from '../carrito/apoyo-carrito.js';
import { fijarExistencia, unaFila } from '../datos-de-prueba.js';
import {
  clienteConCarrito,
  crearCupon,
  type LimitesCupon,
  iniciarPago,
  leerSesionPago,
  metodoEnvio,
  nuevaDireccion,
  reservasDe,
} from './apoyo-checkout.js';

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

const cupon = (limites: LimitesCupon) => crearCupon(app, tokenAdmin, limites);

const usosDe = async (idCupon: number) =>
  leerDatos(
    await request(app)
      .get(`/api/v1/admin/cupones/${String(idCupon)}`)
      .set(comoCliente(tokenAdmin)),
    z.object({ usosComprometidos: z.number() }),
  ).usosComprometidos;

const aplicarCupon = (token: string, codigo: string) =>
  request(app).put('/api/v1/carrito/cupon').set(comoCliente(token)).send({ codigo });

const cambiarPrecio = (idVariante: number, precio: string) =>
  request(app)
    .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
    .set(comoCliente(tokenAdmin))
    .send({ precio });

describe('iniciar la sesión de pago (E5-H01, 01 §6.1)', () => {
  it('reserva cada línea, congela precios, descuento, envío y dirección y responde 201', async () => {
    const a = await varianteVendible('100.00', 10);
    const b = await varianteVendible('50.00', 10);
    const cliente = await clienteConCarrito(app, [
      { idVariante: a.IDVariante, cantidad: 2 },
      { idVariante: b.IDVariante, cantidad: 1 },
    ]);

    const respuesta = await iniciarPago(app, cliente, estandar);

    expect(respuesta.status).toBe(201);
    const sesion = leerSesionPago(respuesta);
    expect(sesion).toMatchObject({
      subtotal: '250.00',
      descuento: '0.00',
      envio: { idMetodoEnvio: estandar, costo: '35.00' },
      total: '285.00',
      direccion: { nombreRecibe: 'Ana Pérez' },
      intentosRechazados: 0,
    });
    expect(Date.parse(sesion.expiraEn) - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(await reservasDe(sesion.idSesion)).toEqual([
      {
        IDVariante: Math.min(a.IDVariante, b.IDVariante),
        Cantidad: a.IDVariante < b.IDVariante ? 2 : 1,
        Estado: 'Activa',
      },
      {
        IDVariante: Math.max(a.IDVariante, b.IDVariante),
        Cantidad: a.IDVariante < b.IDVariante ? 1 : 2,
        Estado: 'Activa',
      },
    ]);
  });

  it('un cambio de precio posterior no afecta la sesión', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    await iniciarPago(app, cliente, estandar);

    await cambiarPrecio(IDVariante, '150.00');
    const sesion = leerSesionPago(
      await request(app).get('/api/v1/checkout/sesion').set(comoCliente(cliente.token)),
    );

    expect(sesion.lineas).toMatchObject([{ precioUnitario: '100.00' }]);
    expect(sesion.total).toBe('135.00');
  });

  it('todo o nada: si una línea no alcanza, 409 con el disponible y ninguna reserva ni uso del cupón', async () => {
    const sobra = await varianteVendible('30.00', 10);
    const escasa = await varianteVendible('30.00', 10);
    const cliente = await clienteConCarrito(app, [
      { idVariante: sobra.IDVariante, cantidad: 2 },
      { idVariante: escasa.IDVariante, cantidad: 3 },
    ]);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 5 });
    await aplicarCupon(cliente.token, codigo);
    await fijarExistencia(escasa.IDVariante, 3);
    await request(app)
      .post('/api/v1/inventario/ajustes')
      .set(comoCliente(tokenOperador))
      .send({ idVariante: escasa.IDVariante, cantidad: -1, motivo: 'Conteo' });

    const respuesta = await iniciarPago(app, cliente, estandar);

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: escasa.IDVariante, cantidad: 3, disponible: 2 }],
    });
    expect(
      (await request(app).get('/api/v1/checkout/sesion').set(comoCliente(cliente.token))).status,
    ).toBe(404);
    expect(await usosDe(idCupon)).toBe(0);
  });

  it('una línea NoDisponible responde 409 LINEAS_NO_DISPONIBLES con la línea', async () => {
    const { IDProducto, IDVariante } = await varianteVendible('30.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    await request(app)
      .post(`/api/v1/admin/productos/${String(IDProducto)}/desactivar`)
      .set(comoCliente(tokenAdmin));

    const respuesta = await iniciarPago(app, cliente, estandar);

    expect(leerError(respuesta)).toMatchObject({
      codigo: 'LINEAS_NO_DISPONIBLES',
      detalles: [{ idVariante: IDVariante, estado: 'NoDisponible' }],
    });
  });

  it('el cupón queda reservado (UsosComprometidos + 1) y el descuento congelado', async () => {
    const { IDVariante } = await varianteVendible('40.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 3 });
    await aplicarCupon(cliente.token, codigo);

    const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));

    expect(sesion).toMatchObject({ codigoCupon: codigo, descuento: '5.00', total: '70.00' });
    expect(await usosDe(idCupon)).toBe(1);
    expect(
      await unaFila('SP_Pruebas_LeerSesionCheckout', {
        IDSesionCheckout: { tipo: sql.Int, valor: sesion.idSesion },
      }),
    ).toMatchObject({ EstadoUsoCupon: 'Reservado' });
  });

  it('el cupón con un solo uso y cinco clientes simultáneos: uno lo reserva y cuatro reciben 422 CUPON_AGOTADO', async () => {
    const { IDVariante } = await varianteVendible('40.00', 50);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 1 });
    const clientes = await Promise.all(
      Array.from({ length: 5 }, () =>
        clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]),
      ),
    );
    for (const cliente of clientes) await aplicarCupon(cliente.token, codigo);

    const respuestas = await Promise.all(clientes.map((c) => iniciarPago(app, c, estandar)));

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(1);
    const rechazos = respuestas.filter((r) => r.status === 422);
    expect(rechazos).toHaveLength(4);
    expect(rechazos.every((r) => leerError(r).codigo === 'CUPON_AGOTADO')).toBe(true);
    expect(await usosDe(idCupon)).toBe(1);
  });

  it('un cupón que dejó de ser válido entre el carrito y el inicio responde su 422 y no reserva nada', async () => {
    const { IDVariante } = await varianteVendible('40.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 3 });
    await aplicarCupon(cliente.token, codigo);
    await request(app)
      .post(`/api/v1/admin/cupones/${String(idCupon)}/desactivar`)
      .set(comoCliente(tokenAdmin));

    const respuesta = await iniciarPago(app, cliente, estandar);
    const carrito = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));

    expect(respuesta.status).toBe(422);
    expect(leerError(respuesta).codigo).toBe('CUPON_INACTIVO');
    expect(carrito.resumen.cuponRetirado).toMatchObject({ motivo: 'CUPON_INACTIVO' });
  });
});

describe('reutilizar o reemplazar la sesión (E5-H01, N-02)', () => {
  it('sin cambios devuelve la misma sesión con 200 y no reserva otra vez', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 2 }]);
    const primera = leerSesionPago(await iniciarPago(app, cliente, estandar));

    const repetida = await iniciarPago(app, cliente, estandar);

    expect(repetida.status).toBe(200);
    expect(leerSesionPago(repetida).idSesion).toBe(primera.idSesion);
    expect(await reservasDe(primera.idSesion)).toEqual([
      { IDVariante, Cantidad: 2, Estado: 'Activa' },
    ]);
  });

  it('dos carritos iguales dan el mismo hash: las mismas líneas agregadas en otro orden reutilizan la sesión', async () => {
    const a = await varianteVendible('20.00', 10);
    const b = await varianteVendible('7.50', 10);
    const cliente = await clienteConCarrito(app, [
      { idVariante: a.IDVariante, cantidad: 1 },
      { idVariante: b.IDVariante, cantidad: 2 },
    ]);
    const primera = leerSesionPago(await iniciarPago(app, cliente, estandar));
    const carrito = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));
    const lineaA = carrito.lineas.find((l) => l.idVariante === a.IDVariante);
    await quitarLinea(app, comoCliente(cliente.token), lineaA?.idLinea ?? 0);
    await agregar(app, comoCliente(cliente.token), a.IDVariante, 1);

    const repetida = await iniciarPago(app, cliente, estandar);

    expect(repetida.status).toBe(200);
    expect(leerSesionPago(repetida).idSesion).toBe(primera.idSesion);
  });

  it.each([
    ['otra cantidad', 'cantidad'],
    ['otra dirección', 'direccion'],
    ['una baja de precio', 'precio'],
  ] as const)(
    'con %s cancela la anterior (libera reservas y cupón) y crea otra (201)',
    async (_caso, cambio) => {
      const { IDVariante } = await varianteVendible('20.00', 10);
      const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
      const { codigo, idCupon } = await cupon({ limiteUsosTotal: 5 });
      await aplicarCupon(cliente.token, codigo);
      const primera = leerSesionPago(await iniciarPago(app, cliente, estandar));
      let idDireccion = cliente.idDireccion;
      if (cambio === 'cantidad') await agregar(app, comoCliente(cliente.token), IDVariante, 1);
      if (cambio === 'direccion')
        idDireccion = await nuevaDireccion(app, cliente.token, 'Otra calle 1-1');
      if (cambio === 'precio') await cambiarPrecio(IDVariante, '18.00');

      const segunda = await iniciarPago(app, cliente, estandar, idDireccion);

      expect(segunda.status).toBe(201);
      expect(leerSesionPago(segunda).idSesion).not.toBe(primera.idSesion);
      expect(
        await unaFila('SP_Pruebas_LeerSesionCheckout', {
          IDSesionCheckout: { tipo: sql.Int, valor: primera.idSesion },
        }),
      ).toMatchObject({
        Estado: 'Cancelada',
        EstadoReserva: 'Liberada',
        EstadoUsoCupon: 'Liberado',
      });
      expect(await usosDe(idCupon)).toBe(1);
    },
  );

  it('una sesión con un pago en curso no se cancela: POST con otro contenido y DELETE responden 409', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));
    await ejecutarSP('SP_Pruebas_InsertarIntentoPago', {
      IDSesionCheckout: { tipo: sql.Int, valor: sesion.idSesion },
      Estado: { tipo: sql.VarChar(12), valor: 'Pendiente' },
    });
    await agregar(app, comoCliente(cliente.token), IDVariante, 1);

    const otra = await iniciarPago(app, cliente, estandar);
    const cancelar = await request(app)
      .delete('/api/v1/checkout/sesion')
      .set(comoCliente(cliente.token));

    expect([leerError(otra).codigo, leerError(cancelar).codigo]).toEqual([
      'PAGO_EN_CURSO',
      'PAGO_EN_CURSO',
    ]);
    expect(await reservasDe(sesion.idSesion)).toEqual([
      { IDVariante, Cantidad: 1, Estado: 'Activa' },
    ]);
  });

  it('las reservas propias no hacen ver agotado el carrito del cliente mientras paga', async () => {
    const { IDVariante } = await varianteVendible('20.00', 2);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 2 }]);
    await iniciarPago(app, cliente, estandar);

    const carrito = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));
    const otro = await clienteConCarrito(app, []);
    const ajeno = await agregar(app, comoCliente(otro.token), IDVariante, 1);

    expect(carrito.lineas).toMatchObject([{ estado: 'Disponible' }]);
    expect(ajeno.status).toBe(409);
  });
});

describe('concurrencia, permisos y cancelación (E5-H01)', () => {
  it('cinco POST simultáneos del mismo cliente: una sola sesión, un solo juego de reservas', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 3 }]);

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => iniciarPago(app, cliente, estandar)),
    );

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    const ids = new Set(respuestas.map((r) => leerSesionPago(r).idSesion));
    expect(ids.size).toBe(1);
    expect(await reservasDe([...ids][0] ?? 0)).toEqual([
      { IDVariante, Cantidad: 3, Estado: 'Activa' },
    ]);
  });

  it('variantes compartidas en orden inverso entre clientes simultáneos: ningún 500', async () => {
    const a = await varianteVendible('10.00', 100);
    const b = await varianteVendible('10.00', 100);
    const clientes = await Promise.all(
      Array.from({ length: 10 }, (_v, i) =>
        clienteConCarrito(
          app,
          i % 2 === 0
            ? [
                { idVariante: a.IDVariante, cantidad: 1 },
                { idVariante: b.IDVariante, cantidad: 1 },
              ]
            : [
                { idVariante: b.IDVariante, cantidad: 1 },
                { idVariante: a.IDVariante, cantidad: 1 },
              ],
        ),
      ),
    );

    const respuestas = await Promise.all(clientes.map((c) => iniciarPago(app, c, estandar)));

    expect(respuestas.map((r) => r.status)).toEqual(Array(10).fill(201));
  });

  it('DELETE cancela y libera; sin sesión responde 404', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const sesion = leerSesionPago(await iniciarPago(app, cliente, estandar));

    const cancelar = await request(app)
      .delete('/api/v1/checkout/sesion')
      .set(comoCliente(cliente.token));
    const otraVez = await request(app)
      .delete('/api/v1/checkout/sesion')
      .set(comoCliente(cliente.token));

    expect([cancelar.status, otraVez.status]).toEqual([204, 404]);
    expect(await reservasDe(sesion.idSesion)).toEqual([
      { IDVariante, Cantidad: 1, Estado: 'Liberada' },
    ]);
  });

  it('carrito vacío → 422; dirección ajena o método inexistente → 404', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const vacio = await clienteConCarrito(app, []);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);

    const sinLineas = await iniciarPago(app, vacio, estandar);
    const direccionAjena = await iniciarPago(app, cliente, estandar, vacio.idDireccion);
    const metodoInexistente = await iniciarPago(app, cliente, 2_147_483_647);

    expect(leerError(sinLineas).codigo).toBe('CARRITO_VACIO');
    expect([direccionAjena.status, metodoInexistente.status]).toEqual([404, 404]);
  });

  it('un invitado recibe 401; Operador y Admin 403; un idUsuario en el cuerpo 400', async () => {
    const { IDVariante } = await varianteVendible('20.00', 10);
    const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
    const cuerpo = { idDireccion: cliente.idDireccion, idMetodoEnvio: estandar };

    const respuestas = await Promise.all([
      request(app).post('/api/v1/checkout/sesion').set(comoInvitado()).send(cuerpo),
      request(app).post('/api/v1/checkout/sesion').set(comoCliente(tokenOperador)).send(cuerpo),
      request(app).post('/api/v1/checkout/sesion').set(comoCliente(tokenAdmin)).send(cuerpo),
      request(app)
        .post('/api/v1/checkout/sesion')
        .set(comoCliente(cliente.token))
        .send({ ...cuerpo, idUsuario: 1 }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([401, 403, 403, 400]);
  });
});
