import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { unaFila } from '../datos-de-prueba.js';
import {
  agregar,
  clienteNuevo,
  comoCliente,
  invitadoConCarrito,
  leerCarrito,
  varianteVendible,
  verCarrito,
  type Comprador,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const DIA_MS = 24 * 60 * 60 * 1000;

let tokenAdmin: string;
let tokenOperador: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
});

async function cupon(limites: { limiteUsosTotal: number; limiteUsosPorCliente: number }) {
  const codigo = `R${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/cupones')
    .set(comoCliente(tokenAdmin))
    .send({
      codigo,
      descripcion: 'Cupón con reservas',
      tipo: 'MontoFijo',
      valor: '5.00',
      fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
      fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
      ...limites,
    });
  return { codigo, idCupon: (respuesta.body as { datos: { idCupon: number } }).datos.idCupon };
}

/** N-12: una sesión de pago activa del cliente, sobre su carrito Activo, con el uso del cupón reservado. */
async function reservarUso(idUsuario: number, idVariante: number, idCupon: number) {
  const { IDSesionCheckout } = await unaFila<{ IDSesionCheckout: number }>(
    'SP_Pruebas_CrearSesionConReserva',
    {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      IDVariante: { tipo: sql.Int, valor: idVariante },
      Cantidad: { tipo: sql.Int, valor: 1 },
      IDCupon: { tipo: sql.Int, valor: idCupon },
    },
  );
  return IDSesionCheckout;
}

const aplicar = (comprador: Comprador, codigo: string) =>
  request(app).put('/api/v1/carrito/cupon').set(comprador).send({ codigo });

/** Cierra el carrito del cliente (con su sesión aún activa) y abre otro con un producto. */
async function carritoNuevo(cliente: { token: string; idUsuario: number }, idVariante: number) {
  await ejecutarSP('SP_Pruebas_CerrarCarritoActivo', {
    IDUsuario: { tipo: sql.Int, valor: cliente.idUsuario },
  });
  await agregar(app, comoCliente(cliente.token), idVariante);
}

describe('reservas de uso del cupón (E4-H05, N-12)', () => {
  it('la reserva de la sesión de pago de este mismo carrito no cuenta: volver al carrito no quita el cupón', async () => {
    const { IDVariante } = await varianteVendible('30.00', 10);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 1, limiteUsosPorCliente: 1 });
    await reservarUso(cliente.idUsuario, IDVariante, idCupon);

    const aplicado = await aplicar(comoCliente(cliente.token), codigo);
    const consulta = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));

    expect(aplicado.status).toBe(200);
    expect(consulta.resumen).toMatchObject({ cupon: { codigo }, cuponRetirado: null });
  });

  it('la reserva de este mismo carrito que ya venció pero aún no se libera tampoco cuenta: el cupón sigue', async () => {
    const { IDVariante } = await varianteVendible('30.00', 10);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 1, limiteUsosPorCliente: 1 });
    const idSesion = await reservarUso(cliente.idUsuario, IDVariante, idCupon);
    await aplicar(comoCliente(cliente.token), codigo);
    await ejecutarSP('SP_Pruebas_VencerSesionCheckout', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    });

    const consulta = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));

    expect(consulta.resumen).toMatchObject({ cupon: { codigo }, cuponRetirado: null });
  });

  it('un uso reservado del cliente en otra sesión activa cuenta para su límite', async () => {
    const { IDVariante } = await varianteVendible('30.00', 10);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 5, limiteUsosPorCliente: 1 });
    await reservarUso(cliente.idUsuario, IDVariante, idCupon);
    await carritoNuevo(cliente, IDVariante);

    const respuesta = await aplicar(comoCliente(cliente.token), codigo);

    expect(leerError(respuesta).codigo).toBe('CUPON_LIMITE_CLIENTE');
  });

  it('la reserva de otro carrito sí cuenta para el agotado', async () => {
    const { IDVariante } = await varianteVendible('30.00', 10);
    const duena = await clienteNuevo(app);
    await agregar(app, comoCliente(duena.token), IDVariante);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 1, limiteUsosPorCliente: 1 });
    await reservarUso(duena.idUsuario, IDVariante, idCupon);
    const otro = await invitadoConCarrito(app, IDVariante);

    const respuesta = await request(app)
      .put('/api/v1/carrito/cupon')
      .set({ Cookie: `carrito_invitado=${otro.token}` })
      .send({ codigo });

    expect(leerError(respuesta).codigo).toBe('CUPON_AGOTADO');
  });

  it('una reserva de una sesión vencida no cuenta para el límite por cliente', async () => {
    const { IDVariante } = await varianteVendible('30.00', 10);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const { codigo, idCupon } = await cupon({ limiteUsosTotal: 5, limiteUsosPorCliente: 1 });
    const idSesion = await reservarUso(cliente.idUsuario, IDVariante, idCupon);
    await ejecutarSP('SP_Pruebas_VencerSesionCheckout', {
      IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
    });
    await carritoNuevo(cliente, IDVariante);

    const respuesta = await aplicar(comoCliente(cliente.token), codigo);

    expect(respuesta.status).toBe(200);
  });
});

describe('existencia con reservas y permisos del cupón (E4-H01, E4-H05, N-06)', () => {
  it('las reservas vigentes de otros reducen lo que se puede agregar; las vencidas no', async () => {
    const { IDVariante } = await varianteVendible('10.00', 5);
    const reserva = (cantidad: number, minutos: number) =>
      ejecutarSP('SP_Pruebas_CrearReserva', {
        IDVariante: { tipo: sql.Int, valor: IDVariante },
        Cantidad: { tipo: sql.Int, valor: cantidad },
        MinutosParaVencer: { tipo: sql.Int, valor: minutos },
      });
    await reserva(3, 15);
    await reserva(2, -1);
    const cliente = await clienteNuevo(app);

    const excedida = await agregar(app, comoCliente(cliente.token), IDVariante, 3);
    const justa = await agregar(app, comoCliente(cliente.token), IDVariante, 2);

    expect(leerError(excedida)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: IDVariante, disponible: 2, enCarrito: 0 }],
    });
    expect(justa.status).toBe(200);
  });

  it('el Operador recibe 403 al aplicar o quitar un cupón', async () => {
    const respuestas = await Promise.all([
      aplicar(comoCliente(tokenOperador), 'CUALQUIERA'),
      request(app).delete('/api/v1/carrito/cupon').set(comoCliente(tokenOperador)),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([403, 403]);
  });
});
