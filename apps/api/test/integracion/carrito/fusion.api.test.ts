import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import sql from 'mssql';
import request, { type Response } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearLogger } from '../../../src/shared/observability/index.js';
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
  primeraLinea,
  vencerGarantia,
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

  it('la garantía vencida del cliente pierde contra la vigente del invitado, aunque esta sea más alta', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteRegistrado();
    const delCliente = primeraLinea(
      leerCarrito(await agregar(app, comoCliente(cliente.accessToken), IDVariante)),
    );
    await vencerGarantia(delCliente.idLinea);
    await cambiarPrecio(IDVariante, '120.00');
    const invitado = await invitadoConCarrito(app, IDVariante);

    await login(cliente.correo, invitado.token);

    const linea = await lineaDe(cliente.accessToken, IDVariante);
    expect(linea).toMatchObject({ cantidad: 2, precioUnitario: '120.00', aviso: null });
    expect(Date.parse(linea?.garantiaHasta ?? '')).toBeGreaterThan(Date.now());
  });

  it('con las dos garantías vencidas se conserva la del cliente y se avisa el cambio de precio', async () => {
    const { IDVariante } = await varianteVendible('100.00', 10);
    const cliente = await clienteRegistrado();
    const delCliente = primeraLinea(
      leerCarrito(await agregar(app, comoCliente(cliente.accessToken), IDVariante)),
    );
    await cambiarPrecio(IDVariante, '110.00');
    const invitado = await invitadoConCarrito(app, IDVariante);
    await vencerGarantia(delCliente.idLinea);
    await vencerGarantia(primeraLinea(invitado.carrito).idLinea);
    await cambiarPrecio(IDVariante, '120.00');

    await login(cliente.correo, invitado.token);

    expect(await lineaDe(cliente.accessToken, IDVariante)).toMatchObject({
      precioUnitario: '120.00',
      aviso: { tipo: 'CambioDePrecio', precioAnterior: '100.00' },
    });
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

describe('si pasar el carrito de invitado falla dentro del SP (E4-H03, N-05)', () => {
  const pendienteSchema = z.object({
    avisosCarrito: z.array(
      z.strictObject({ tipo: z.literal('FusionPendiente'), mensaje: z.string() }),
    ),
  });

  /** TR_Pruebas_FallarPaseDeCarrito hace fallar el SP si el carrito tiene un SKU 'FALLA-…'. */
  const cambiarSku = (idVariante: number, sku: string) =>
    request(app)
      .patch(`/api/v1/admin/variantes/${String(idVariante)}`)
      .set(comoCliente(tokenAdmin))
      .send({ sku });

  async function invitadoQueFalla() {
    const { IDVariante: normal } = await varianteVendible('10.00', 10);
    const { IDVariante: conFalla } = await varianteVendible('10.00', 10);
    const skuFalla = `FALLA-${randomUUID().slice(0, 8)}`;
    expect((await cambiarSku(conFalla, skuFalla)).status).toBe(200);
    const invitado = await invitadoConCarrito(app, normal, 2);
    await agregar(app, comoInvitado(invitado.token), conFalla, 1);
    return { ...invitado, conFalla };
  }

  it('el login responde 200 con FusionPendiente, conserva la cookie y la base queda como estaba', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const conLogs = crearApp(dependenciasDePrueba({ logger: crearLogger({ destino }) }));
    const { IDVariante: delCliente } = await varianteVendible('10.00', 10);
    const cliente = await clienteRegistrado();
    await agregar(app, comoCliente(cliente.accessToken), delCliente);
    const { IDSesionCheckout } = await unaFila<{ IDSesionCheckout: number }>(
      'SP_Pruebas_CrearSesionConReserva',
      {
        IDUsuario: { tipo: sql.Int, valor: cliente.usuario.idUsuario },
        IDVariante: { tipo: sql.Int, valor: delCliente },
        Cantidad: { tipo: sql.Int, valor: 1 },
      },
    );
    const invitado = await invitadoQueFalla();

    const respuesta = await request(conLogs)
      .post('/api/v1/auth/login')
      .set(comoInvitado(invitado.token))
      .send({ correo: cliente.correo, contrasena: CONTRASENA });

    expect(respuesta.status).toBe(200);
    expect(leerSesion(respuesta).accessToken.length).toBeGreaterThan(0);
    expect(leerDatos(respuesta, pendienteSchema).avisosCarrito).toHaveLength(1);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(await carritosConHash(hashDe(invitado.token))).toMatchObject([
      { Estado: 'Activo', Lineas: 2 },
    ]);
    expect(await carritosDelCliente(cliente.usuario.idUsuario)).toMatchObject([
      { Estado: 'Activo', Lineas: 1 },
    ]);
    expect(
      await unaFila('SP_Pruebas_LeerSesionCheckout', {
        IDSesionCheckout: { tipo: sql.Int, valor: IDSesionCheckout },
      }),
    ).toMatchObject({ Estado: 'Activa', EstadoReserva: 'Activa' });
    const log = lineas.join('');
    expect(log).toContain('No se pudo pasar el carrito de invitado al cliente');
    expect(log).toContain('Falla simulada al pasar el carrito de invitado');
    expect(log).not.toContain(invitado.token);
  });

  it('con un pago en curso del cliente la fusión se pospone con FusionPendiente y la cookie se conserva', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);
    const cliente = await clienteRegistrado();
    const { IDSesionCheckout } = await unaFila<{ IDSesionCheckout: number }>(
      'SP_Pruebas_CrearSesionConReserva',
      {
        IDUsuario: { tipo: sql.Int, valor: cliente.usuario.idUsuario },
        IDVariante: { tipo: sql.Int, valor: IDVariante },
        Cantidad: { tipo: sql.Int, valor: 1 },
      },
    );
    await unaFila('SP_Pruebas_InsertarIntentoPago', {
      IDSesionCheckout: { tipo: sql.Int, valor: IDSesionCheckout },
      Estado: { tipo: sql.VarChar(12), valor: 'Pendiente' },
    });
    const invitado = await invitadoConCarrito(app, IDVariante);

    const respuesta = await login(cliente.correo, invitado.token);

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, pendienteSchema).avisosCarrito).toHaveLength(1);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(await carritosConHash(hashDe(invitado.token))).toMatchObject([{ Estado: 'Activo' }]);
  });

  it('la fusión se reintenta en el siguiente inicio de sesión', async () => {
    const cliente = await clienteRegistrado();
    const invitado = await invitadoQueFalla();
    await login(cliente.correo, invitado.token);
    await cambiarSku(invitado.conFalla, `OK-${randomUUID().slice(0, 8)}`);

    const reintento = await login(cliente.correo, invitado.token);

    expect(cookieCarrito(reintento)).toMatch(COOKIE_BORRADA);
    expect(await carritosDelCliente(cliente.usuario.idUsuario)).toMatchObject([{ Lineas: 2 }]);
  });

  it('al registrarse responde 201 con FusionPendiente y el carrito de invitado sigue siendo del invitado', async () => {
    const invitado = await invitadoQueFalla();

    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .set(comoInvitado(invitado.token))
      .send({ correo: correoUnico(), contrasena: CONTRASENA, nombre: 'Cliente nuevo' });

    expect(respuesta.status).toBe(201);
    expect(leerDatos(respuesta, pendienteSchema).avisosCarrito).toHaveLength(1);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(await carritosConHash(hashDe(invitado.token))).toMatchObject([{ Estado: 'Activo' }]);
  });
});
