import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { CONTRASENA, correoUnico, iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  clienteNuevo,
  comoCliente,
  comoInvitado,
  invitadoConCarrito,
  leerCarrito,
  quitarLinea,
  varianteVendible,
  verCarrito,
  type Comprador,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const DIA_MS = 24 * 60 * 60 * 1000;

let tokenAdmin: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

const comoAdmin = () => comoCliente(tokenAdmin);

/** Un cupón nuevo (por defecto Q10.00 de monto fijo, vigente, 5 usos); devuelve su código e ID. */
async function cupon(cambios: Record<string, unknown> = {}) {
  const codigo = `C${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/cupones')
    .set(comoAdmin())
    .send({
      codigo,
      descripcion: 'Cupón de prueba',
      tipo: 'MontoFijo',
      valor: '10.00',
      fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
      fechaFin: new Date(Date.now() + 30 * DIA_MS).toISOString(),
      limiteUsosTotal: 5,
      ...cambios,
    });
  expect(respuesta.status).toBe(201);
  return { codigo, idCupon: leerDatos(respuesta, z.object({ idCupon: z.number() })).idCupon };
}

const aplicar = (comprador: Comprador, codigo: string) =>
  request(app).put('/api/v1/carrito/cupon').set(comprador).send({ codigo });

const categoriaDe = async (idProducto: number): Promise<number> =>
  leerDatos(
    await request(app)
      .get(`/api/v1/admin/productos/${String(idProducto)}`)
      .set(comoAdmin()),
    z.object({ idCategoria: z.number() }),
  ).idCategoria;

/** Un invitado con una línea por precio (1 unidad cada una), en el orden dado. */
async function carritoConPrecios(...precios: string[]) {
  const [primero, ...resto] = precios;
  const { IDVariante } = await varianteVendible(primero, 10);
  const { token } = await invitadoConCarrito(app, IDVariante);
  for (const precio of resto) {
    await agregar(app, comoInvitado(token), (await varianteVendible(precio, 10)).IDVariante);
  }
  return token;
}

describe('reparto del descuento (E4-H05, N-02)', () => {
  it('Q10.00 entre tres líneas iguales: el centavo sobrante va a la primera (desempate por IDLinea)', async () => {
    const token = await carritoConPrecios('20.00', '20.00', '20.00');
    const { codigo } = await cupon({ valor: '10.00' });

    const carrito = leerCarrito(await aplicar(comoInvitado(token), codigo));

    expect(carrito.lineas.map((l) => l.descuentoLinea)).toEqual(['3.34', '3.33', '3.33']);
    expect(carrito.resumen).toMatchObject({
      subtotal: '60.00',
      descuento: '10.00',
      total: '50.00',
      cupon: { codigo },
    });
  });

  it('el centavo sobrante va a la línea de mayor monto', async () => {
    const token = await carritoConPrecios('10.00', '30.00', '20.00');
    const { codigo } = await cupon({ valor: '1.00' });

    const carrito = leerCarrito(await aplicar(comoInvitado(token), codigo));

    expect(carrito.lineas.map((l) => [l.totalLinea, l.descuentoLinea])).toEqual([
      ['10.00', '0.16'],
      ['30.00', '0.51'],
      ['20.00', '0.33'],
    ]);
    expect(carrito.resumen.descuento).toBe('1.00');
  });

  it('casi todo el subtotal: el sobrante sigue a la siguiente línea sin pasar del total de ninguna', async () => {
    const token = await carritoConPrecios('3.33', '3.33', '3.34');
    const { codigo } = await cupon({ valor: '9.99' });

    const carrito = leerCarrito(await aplicar(comoInvitado(token), codigo));

    const descuentos = carrito.lineas.map((l) => Number(l.descuentoLinea) * 100);
    expect(descuentos.reduce((a, b) => a + b, 0)).toBe(999);
    for (const linea of carrito.lineas) {
      expect(Number(linea.descuentoLinea)).toBeLessThanOrEqual(Number(linea.totalLinea));
    }
    expect(carrito.resumen.total).toBe('0.01');
  });

  it('un porcentaje se redondea al centavo y respeta su tope', async () => {
    const token = await carritoConPrecios('33.33');
    const sinTope = await cupon({ tipo: 'Porcentaje', valor: '10' });
    const conTope = await cupon({ tipo: 'Porcentaje', valor: '50', montoMaximoDescuento: '5.00' });

    const primero = leerCarrito(await aplicar(comoInvitado(token), sinTope.codigo));
    const segundo = leerCarrito(await aplicar(comoInvitado(token), conTope.codigo));

    expect(primero.resumen.descuento).toBe('3.33');
    expect(segundo.resumen).toMatchObject({ descuento: '5.00', total: '28.33' });
  });

  it('un monto fijo mayor que el subtotal deja el total en cero, nunca negativo', async () => {
    const token = await carritoConPrecios('12.50', '7.50');
    const { codigo } = await cupon({ valor: '500.00' });

    const carrito = leerCarrito(await aplicar(comoInvitado(token), codigo));

    expect(carrito.resumen).toMatchObject({ subtotal: '20.00', descuento: '20.00', total: '0.00' });
    expect(carrito.lineas.map((l) => l.descuentoLinea)).toEqual(['12.50', '7.50']);
  });

  it('un cupón de categoría solo descuenta sus líneas; el mínimo se mide sobre todo el carrito', async () => {
    const deLaCategoria = await varianteVendible('20.00', 10);
    const otra = await varianteVendible('40.00', 10);
    const { token } = await invitadoConCarrito(app, deLaCategoria.IDVariante);
    await agregar(app, comoInvitado(token), otra.IDVariante);
    const { codigo } = await cupon({
      valor: '50.00',
      idCategoria: await categoriaDe(deLaCategoria.IDProducto),
      montoMinimoCompra: '60.00',
    });

    const carrito = leerCarrito(await aplicar(comoInvitado(token), codigo));

    expect(carrito.lineas.map((l) => l.descuentoLinea)).toEqual(['20.00', '0.00']);
    expect(carrito.resumen).toMatchObject({ descuento: '20.00', total: '40.00' });
  });
});

describe('causas de rechazo (E4-H05, N-12)', () => {
  async function rechazo(
    cambios: Record<string, unknown>,
    preparar?: (idCupon: number) => Promise<unknown>,
  ) {
    const token = await carritoConPrecios('30.00');
    const { codigo, idCupon } = await cupon(cambios);
    await preparar?.(idCupon);
    return aplicar(comoInvitado(token), codigo);
  }

  it.each([
    ['inactivo', 'CUPON_INACTIVO', { activo: false }],
    [
      'aún no vigente',
      'CUPON_NO_VIGENTE_AUN',
      { fechaInicio: new Date(Date.now() + DIA_MS).toISOString() },
    ],
    [
      'vencido',
      'CUPON_VENCIDO',
      {
        fechaInicio: new Date(Date.now() - 2 * DIA_MS).toISOString(),
        fechaFin: new Date(Date.now() - DIA_MS).toISOString(),
      },
    ],
    ['de otra categoría', 'CUPON_SIN_PRODUCTOS_CATEGORIA', {}],
  ])('%s responde %s (422) con su mensaje', async (_caso, codigoError, cambios) => {
    const extra =
      codigoError === 'CUPON_SIN_PRODUCTOS_CATEGORIA'
        ? { idCategoria: await categoriaDe((await varianteVendible()).IDProducto) }
        : {};

    const respuesta = await rechazo({ ...cambios, ...extra });

    expect(respuesta.status).toBe(422);
    expect(leerError(respuesta).codigo).toBe(codigoError);
  });

  it('un código que no existe responde CUPON_NO_EXISTE', async () => {
    const token = await carritoConPrecios('30.00');

    const respuesta = await aplicar(comoInvitado(token), 'NOEXISTE-123');

    expect(leerError(respuesta)).toMatchObject({
      codigo: 'CUPON_NO_EXISTE',
      mensaje: 'El cupón no existe.',
    });
  });

  it('agotado responde CUPON_AGOTADO', async () => {
    const respuesta = await rechazo({ limiteUsosTotal: 2 }, (idCupon) =>
      ejecutarSP('SP_Pruebas_FijarUsosCupon', {
        IDCupon: { tipo: sql.Int, valor: idCupon },
        UsosComprometidos: { tipo: sql.Int, valor: 2 },
      }),
    );

    expect(leerError(respuesta).codigo).toBe('CUPON_AGOTADO');
  });

  it('el mínimo no alcanzado indica cuánto falta', async () => {
    const respuesta = await rechazo({ montoMinimoCompra: '100.00' });

    expect(leerError(respuesta)).toMatchObject({
      codigo: 'CUPON_MINIMO_NO_ALCANZADO',
      detalles: { faltante: '70.00' },
    });
  });

  it('el límite por cliente cuenta los usos confirmados; al invitado no le aplica', async () => {
    const cliente = await clienteNuevo(app);
    const { IDVariante } = await varianteVendible('30.00', 10);
    const { codigo, idCupon } = await cupon({ limiteUsosPorCliente: 1 });
    await ejecutarSP('SP_Pruebas_ConfirmarUsoCupon', {
      IDUsuario: { tipo: sql.Int, valor: cliente.idUsuario },
      IDCupon: { tipo: sql.Int, valor: idCupon },
    });
    await agregar(app, comoCliente(cliente.token), IDVariante);
    const invitado = await invitadoConCarrito(app, IDVariante);

    const delCliente = await aplicar(comoCliente(cliente.token), codigo);
    const delInvitado = await aplicar(comoInvitado(invitado.token), codigo);

    expect(leerError(delCliente).codigo).toBe('CUPON_LIMITE_CLIENTE');
    expect(delInvitado.status).toBe(200);
  });

  it('sin carrito o con el carrito vacío responde CARRITO_VACIO', async () => {
    const { codigo } = await cupon();

    const respuesta = await aplicar(comoInvitado(), codigo);

    expect(leerError(respuesta).codigo).toBe('CARRITO_VACIO');
  });

  it('un código vacío responde 400', async () => {
    const respuesta = await aplicar(comoInvitado(), '   ');

    expect(respuesta.status).toBe(400);
  });
});

describe('revalidación y retiro del cupón (E4-H05, N-12)', () => {
  it('si deja de ser válido, al consultar el carrito se quita con aviso del motivo (una sola vez)', async () => {
    const token = await carritoConPrecios('30.00');
    const { codigo, idCupon } = await cupon();
    await aplicar(comoInvitado(token), codigo);
    await request(app)
      .post(`/api/v1/admin/cupones/${String(idCupon)}/desactivar`)
      .set(comoAdmin());

    const primera = leerCarrito(await verCarrito(app, comoInvitado(token)));
    const segunda = leerCarrito(await verCarrito(app, comoInvitado(token)));

    expect(primera.resumen).toMatchObject({
      cupon: null,
      descuento: '0.00',
      total: '30.00',
      cuponRetirado: { codigo, motivo: 'CUPON_INACTIVO', mensaje: 'El cupón no está activo.' },
    });
    expect(segunda.resumen.cuponRetirado).toBeNull();
  });

  it('quitar la línea que alcanzaba el mínimo retira el cupón en esa misma respuesta', async () => {
    const barata = await varianteVendible('10.00', 10);
    const cara = await varianteVendible('90.00', 10);
    const { token } = await invitadoConCarrito(app, barata.IDVariante);
    const conCara = leerCarrito(await agregar(app, comoInvitado(token), cara.IDVariante));
    const { codigo } = await cupon({ montoMinimoCompra: '50.00' });
    await aplicar(comoInvitado(token), codigo);
    const lineaCara = conCara.lineas.find((l) => l.idVariante === cara.IDVariante);

    const respuesta = await quitarLinea(app, comoInvitado(token), lineaCara?.idLinea ?? 0);

    expect(leerCarrito(respuesta).resumen.cuponRetirado).toMatchObject({
      motivo: 'CUPON_MINIMO_NO_ALCANZADO',
    });
  });

  it('DELETE /carrito/cupon quita el cupón', async () => {
    const token = await carritoConPrecios('30.00');
    const { codigo } = await cupon();
    await aplicar(comoInvitado(token), codigo);

    const respuesta = await request(app).delete('/api/v1/carrito/cupon').set(comoInvitado(token));

    expect(leerCarrito(respuesta).resumen).toMatchObject({ cupon: null, descuento: '0.00' });
  });

  it('el cupón del invitado pasa al cliente al iniciar sesión si el cliente no tenía uno', async () => {
    const correo = correoUnico();
    await request(app)
      .post('/api/v1/auth/registro')
      .send({ correo, contrasena: CONTRASENA, nombre: 'Cliente de prueba' });
    const token = await carritoConPrecios('30.00');
    const { codigo } = await cupon();
    await aplicar(comoInvitado(token), codigo);

    const sesion = leerSesion(
      await request(app)
        .post('/api/v1/auth/login')
        .set(comoInvitado(token))
        .send({ correo, contrasena: CONTRASENA }),
    );

    const carrito = leerCarrito(await verCarrito(app, comoCliente(sesion.accessToken)));
    expect(carrito.resumen).toMatchObject({ cupon: { codigo }, descuento: '10.00' });
  });
});
