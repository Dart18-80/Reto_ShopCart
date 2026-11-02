import sql from 'mssql';
import request, { type Response } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import type { CarritoDeInvitado } from '../../../src/modules/auth/index.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { CONTRASENA, correoUnico, iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { crearCupon, unaFila } from '../datos-de-prueba.js';
import {
  agregar,
  carritosConHash,
  carritosDelCliente,
  comoCliente,
  comoInvitado,
  cookieCarrito,
  hashDe,
  invitadoConCarrito,
  leerCarrito,
  varianteVendible,
  verCarrito,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const COOKIE_BORRADA = /^carrito_invitado=;.*Path=\/api\/v1;.*Expires=Thu, 01 Jan 1970/;

const avisosSchema = z.object({
  avisosCarrito: z.array(
    z.object({
      idVariante: z.number(),
      producto: z.string(),
      tipo: z.string(),
      cantidadSolicitada: z.number(),
      cantidadFinal: z.number(),
    }),
  ),
});

let tokenAdmin: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

/** Un cliente registrado (sin carrito) y sus credenciales para volver a iniciar sesión. */
async function clienteRegistrado() {
  const correo = correoUnico();
  const respuesta = await request(app)
    .post('/api/v1/auth/registro')
    .send({ correo, contrasena: CONTRASENA, nombre: 'Cliente de prueba' });
  return { correo, ...leerSesion(respuesta) };
}

const login = (correo: string, tokenInvitado?: string) =>
  request(app)
    .post('/api/v1/auth/login')
    .set(comoInvitado(tokenInvitado))
    .send({ correo, contrasena: CONTRASENA });

const avisosDe = (respuesta: Response) => leerDatos(respuesta, avisosSchema).avisosCarrito;

async function cambiarPrecio(idVariante: number, precio: string): Promise<void> {
  await request(app)
    .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
    .set(comoCliente(tokenAdmin))
    .send({ precio });
}

const lineaDe = async (accessToken: string, idVariante: number) => {
  const carrito = leerCarrito(await verCarrito(app, comoCliente(accessToken)));
  return carrito.lineas.find((linea) => linea.idVariante === idVariante);
};

describe('fusión al iniciar sesión (E4-H03, N-05)', () => {
  it('suma la misma variante con el disponible como tope, avisa el ajuste y pasa las variantes nuevas', async () => {
    const { IDVariante: comun } = await varianteVendible('10.00', 5);
    const { IDVariante: nueva } = await varianteVendible('10.00', 5);
    const cliente = await clienteRegistrado();
    await agregar(app, comoCliente(cliente.accessToken), comun, 2);
    const invitado = await invitadoConCarrito(app, comun, 4);
    await agregar(app, comoInvitado(invitado.token), nueva, 3);

    const respuesta = await login(cliente.correo, invitado.token);

    expect(respuesta.status).toBe(200);
    expect(avisosDe(respuesta)).toEqual([
      {
        idVariante: comun,
        producto: expect.any(String) as unknown,
        tipo: 'CantidadAjustada',
        cantidadSolicitada: 6,
        cantidadFinal: 5,
      },
    ]);
    expect((await lineaDe(cliente.accessToken, comun))?.cantidad).toBe(5);
    expect((await lineaDe(cliente.accessToken, nueva))?.cantidad).toBe(3);
  });

  it('el carrito de invitado queda Fusionado y la cookie se borra', async () => {
    const { IDVariante } = await varianteVendible();
    const cliente = await clienteRegistrado();
    const invitado = await invitadoConCarrito(app, IDVariante);

    const respuesta = await login(cliente.correo, invitado.token);

    expect(cookieCarrito(respuesta)).toMatch(COOKIE_BORRADA);
    expect(await carritosConHash(hashDe(invitado.token))).toMatchObject([{ Estado: 'Fusionado' }]);
    expect(leerCarrito(await verCarrito(app, comoInvitado(invitado.token))).lineas).toEqual([]);
    expect(await carritosDelCliente(cliente.usuario.idUsuario)).toMatchObject([
      { Estado: 'Activo', Lineas: 1 },
    ]);
  });

  it('sin avisos cuando todo cabe, y nunca baja la cantidad que el cliente ya tenía', async () => {
    const { IDVariante } = await varianteVendible('10.00', 3);
    const cliente = await clienteRegistrado();
    const invitado = await invitadoConCarrito(app, IDVariante, 1);
    await agregar(app, comoCliente(cliente.accessToken), IDVariante, 3);

    const respuesta = await login(cliente.correo, invitado.token);

    expect(avisosDe(respuesta)).toMatchObject([
      { tipo: 'CantidadAjustada', cantidadSolicitada: 4, cantidadFinal: 3 },
    ]);
    expect((await lineaDe(cliente.accessToken, IDVariante))?.cantidad).toBe(3);
  });

  it('conserva la garantía vigente más favorable (la del invitado si es más baja)', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteRegistrado();
    await agregar(app, comoCliente(cliente.accessToken), IDVariante);
    await cambiarPrecio(IDVariante, '80.00');
    const invitado = await invitadoConCarrito(app, IDVariante);
    await cambiarPrecio(IDVariante, '120.00');

    await login(cliente.correo, invitado.token);

    expect(await lineaDe(cliente.accessToken, IDVariante)).toMatchObject({
      cantidad: 2,
      precioUnitario: '80.00',
      aviso: { tipo: 'PrecioGarantizado' },
    });
  });

  it('conserva la garantía vigente más favorable (la del cliente si es más baja)', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteRegistrado();
    await cambiarPrecio(IDVariante, '90.00');
    await agregar(app, comoCliente(cliente.accessToken), IDVariante);
    await cambiarPrecio(IDVariante, '110.00');
    const invitado = await invitadoConCarrito(app, IDVariante);
    await cambiarPrecio(IDVariante, '130.00');

    await login(cliente.correo, invitado.token);

    expect((await lineaDe(cliente.accessToken, IDVariante))?.precioUnitario).toBe('90.00');
  });

  it('cancela la sesión de checkout activa del cliente y libera sus reservas y el uso del cupón', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);
    const cliente = await clienteRegistrado();
    const idCupon = await crearCupon(5);
    const { IDSesionCheckout } = await unaFila<{ IDSesionCheckout: number }>(
      'SP_Pruebas_CrearSesionConReserva',
      {
        IDUsuario: { tipo: sql.Int, valor: cliente.usuario.idUsuario },
        IDVariante: { tipo: sql.Int, valor: IDVariante },
        Cantidad: { tipo: sql.Int, valor: 2 },
        IDCupon: { tipo: sql.Int, valor: idCupon },
      },
    );
    const invitado = await invitadoConCarrito(app, IDVariante);

    await login(cliente.correo, invitado.token);

    expect(
      await unaFila('SP_Pruebas_LeerSesionCheckout', {
        IDSesionCheckout: { tipo: sql.Int, valor: IDSesionCheckout },
      }),
    ).toEqual({
      Estado: 'Cancelada',
      EstadoReserva: 'Liberada',
      EstadoUsoCupon: 'Liberado',
      UsosComprometidosCupon: 0,
    });
  });

  it('con 49 líneas en el carrito del cliente, solo pasa la variante más antigua del invitado', async () => {
    const cliente = await clienteRegistrado();
    for (let i = 0; i < 49; i++) {
      await agregar(app, comoCliente(cliente.accessToken), (await varianteVendible()).IDVariante);
    }
    const { IDVariante: primera } = await varianteVendible();
    const { IDVariante: segunda } = await varianteVendible();
    const invitado = await invitadoConCarrito(app, primera);
    await agregar(app, comoInvitado(invitado.token), segunda, 2);

    const respuesta = await login(cliente.correo, invitado.token);

    expect(avisosDe(respuesta)).toMatchObject([
      { idVariante: segunda, tipo: 'NoFusionada', cantidadSolicitada: 2, cantidadFinal: 0 },
    ]);
    expect(await lineaDe(cliente.accessToken, primera)).toBeDefined();
    expect(await carritosDelCliente(cliente.usuario.idUsuario)).toMatchObject([{ Lineas: 50 }]);
  }, 30_000);

  it('dos inicios de sesión simultáneos con la misma cookie fusionan una sola vez', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);
    const cliente = await clienteRegistrado();
    const invitado = await invitadoConCarrito(app, IDVariante, 2);

    const respuestas = await Promise.all([
      login(cliente.correo, invitado.token),
      login(cliente.correo, invitado.token),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect((await lineaDe(cliente.accessToken, IDVariante))?.cantidad).toBe(2);
  });

  it('una cookie sin carrito se borra y el login responde normal', async () => {
    const cliente = await clienteRegistrado();

    const respuesta = await login(cliente.correo, 'x'.repeat(43));

    expect(respuesta.status).toBe(200);
    expect(avisosDe(respuesta)).toEqual([]);
    expect(cookieCarrito(respuesta)).toMatch(COOKIE_BORRADA);
  });

  it('el Operador con una cookie de invitado no fusiona y la cookie queda', async () => {
    const { IDVariante } = await varianteVendible();
    const invitado = await invitadoConCarrito(app, IDVariante);

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .set(comoInvitado(invitado.token))
      .send({ correo: 'operador@shopcart.gt', contrasena: 'Operador2026!' });

    expect(respuesta.status).toBe(200);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(await carritosConHash(hashDe(invitado.token))).toMatchObject([{ Estado: 'Activo' }]);
  });
});

describe('carrito de invitado al registrarse (E4-H03, N-05)', () => {
  it('pasa a ser el carrito del cliente nuevo y la cookie se borra', async () => {
    const { IDVariante } = await varianteVendible();
    const invitado = await invitadoConCarrito(app, IDVariante, 2);

    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .set(comoInvitado(invitado.token))
      .send({ correo: correoUnico(), contrasena: CONTRASENA, nombre: 'Cliente nuevo' });
    const sesion = leerSesion(respuesta);

    expect(respuesta.status).toBe(201);
    expect(cookieCarrito(respuesta)).toMatch(COOKIE_BORRADA);
    expect(
      leerCarrito(await verCarrito(app, comoCliente(sesion.accessToken))).lineas,
    ).toMatchObject([{ idVariante: IDVariante, cantidad: 2 }]);
    expect(await carritosDelCliente(sesion.usuario.idUsuario)).toMatchObject([
      { Estado: 'Activo', Lineas: 1 },
    ]);
    expect(await carritosConHash(hashDe(invitado.token))).toEqual([]);
  });
});

describe('si la fusión falla (E4-H03, N-05)', () => {
  it('el login responde igual y la cookie queda para no perder el carrito de invitado', async () => {
    const fallida: CarritoDeInvitado = {
      fusionar: () => Promise.resolve(null),
      asignar: () => Promise.resolve(false),
    };
    const conFalla = crearApp(dependenciasDePrueba({ carritoInvitado: fallida }));
    const cliente = await clienteRegistrado();

    const respuesta = await request(conFalla)
      .post('/api/v1/auth/login')
      .set(comoInvitado('y'.repeat(43)))
      .send({ correo: cliente.correo, contrasena: CONTRASENA });

    expect(respuesta.status).toBe(200);
    expect(leerSesion(respuesta).accessToken.length).toBeGreaterThan(0);
    expect(cookieCarrito(respuesta)).toBeUndefined();
  });
});
