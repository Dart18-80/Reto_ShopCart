import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  comoCliente,
  comoInvitado,
  invitadoConCarrito,
  leerCarrito,
  varianteVendible,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const DIA_MS = 24 * 60 * 60 * 1000;

let tokenAdmin: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

async function cupon(cambios: Record<string, unknown> = {}): Promise<string> {
  const codigo = `B${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/cupones')
    .set(comoCliente(tokenAdmin))
    .send({
      codigo,
      descripcion: 'Cupón de casos borde',
      tipo: 'MontoFijo',
      valor: '1.00',
      fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
      fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
      limiteUsosTotal: 5,
      ...cambios,
    });
  expect(respuesta.status).toBe(201);
  return codigo;
}

const aplicar = (token: string, codigo: string) =>
  request(app).put('/api/v1/carrito/cupon').set(comoInvitado(token)).send({ codigo });

describe('casos borde del carrito (E4, /validar)', () => {
  it.each(['abc', '0', '-1', '1.5', '2147483648'])(
    'un idLinea %s en la ruta responde 400',
    async (idLinea) => {
      const respuestas = await Promise.all([
        request(app).patch(`/api/v1/carrito/lineas/${idLinea}`).send({ cantidad: 1 }),
        request(app).delete(`/api/v1/carrito/lineas/${idLinea}`),
      ]);

      expect(respuestas.map((r) => r.status)).toEqual([400, 400]);
    },
  );

  it('un cuerpo que no es JSON responde 415 y no crea carrito', async () => {
    const respuesta = await request(app)
      .post('/api/v1/carrito/lineas')
      .set('Content-Type', 'text/plain')
      .send('idVariante=1');

    expect(respuesta.status).toBe(415);
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('el código del cupón se aplica sin distinguir mayúsculas ni espacios', async () => {
    const { IDVariante } = await varianteVendible('30.00', 5);
    const { token } = await invitadoConCarrito(app, IDVariante);
    const codigo = await cupon();

    const respuesta = await aplicar(token, `  ${codigo.toLowerCase()} `);

    expect(leerCarrito(respuesta).resumen.cupon?.codigo).toBe(codigo);
  });

  it('un subtotal exactamente igual al mínimo del cupón lo alcanza', async () => {
    const { IDVariante } = await varianteVendible('50.00', 5);
    const { token } = await invitadoConCarrito(app, IDVariante);

    const respuesta = await aplicar(token, await cupon({ montoMinimoCompra: '50.00' }));

    expect(respuesta.status).toBe(200);
  });

  it('un centavo menos que el mínimo indica que falta 0.01', async () => {
    const { IDVariante } = await varianteVendible('49.99', 5);
    const { token } = await invitadoConCarrito(app, IDVariante);

    const respuesta = await aplicar(token, await cupon({ montoMinimoCompra: '50.00' }));

    expect(leerError(respuesta).detalles).toEqual({ faltante: '0.01' });
  });

  it('un total exactamente igual al mínimo de envío gratis lo alcanza', async () => {
    const { IDVariante } = await varianteVendible('500.00', 5);

    const { carrito } = await invitadoConCarrito(app, IDVariante);

    expect(carrito.resumen.envioGratis).toEqual({
      montoMinimo: '500.00',
      faltante: '0.00',
      alcanzado: true,
    });
  });

  it('con montos altos las partes del descuento suman exactamente el total y ninguna pasa de su línea', async () => {
    const precios = ['33333.33', '33333.33', '33333.34', '0.07'];
    const [primera, ...resto] = await Promise.all(precios.map((p) => varianteVendible(p, 5)));
    const { token } = await invitadoConCarrito(app, primera?.IDVariante ?? 0);
    for (const variante of resto) await agregar(app, comoInvitado(token), variante.IDVariante);

    const carrito = leerCarrito(await aplicar(token, await cupon({ valor: '99999.99' })));

    const centavos = (monto: string) => Math.round(Number(monto) * 100);
    const suma = carrito.lineas.reduce((total, l) => total + centavos(l.descuentoLinea), 0);
    expect(suma).toBe(centavos(carrito.resumen.descuento));
    expect(carrito.resumen.descuento).toBe('99999.99');
    for (const linea of carrito.lineas) {
      expect(centavos(linea.descuentoLinea)).toBeLessThanOrEqual(centavos(linea.totalLinea));
    }
  });

  it('agregar la misma variante en dos peticiones simultáneas de un invitado suma ambas', async () => {
    const { IDVariante } = await varianteVendible('5.00', 10);
    const { token } = await invitadoConCarrito(app, IDVariante, 1);

    await Promise.all([
      agregar(app, comoInvitado(token), IDVariante, 2),
      agregar(app, comoInvitado(token), IDVariante, 3),
    ]);

    const carrito = leerCarrito(await request(app).get('/api/v1/carrito').set(comoInvitado(token)));
    expect(carrito.lineas).toMatchObject([{ cantidad: 6 }]);
  });
});
