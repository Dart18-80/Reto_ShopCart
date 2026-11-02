import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  clienteNuevo,
  comoCliente,
  comoInvitado,
  invitadoConCarrito,
  leerCarrito,
  varianteVendible,
  type Comprador,
} from './apoyo-carrito.js';

usarBaseDePruebas();

// El monto de envío gratis es el de la semilla (500.00): las pruebas que lo cambian son secuenciales.
const app = crearApp(dependenciasDePrueba());
const DIA_MS = 24 * 60 * 60 * 1000;

const metodosSchema = z.object({
  metodos: z.array(
    z.strictObject({
      idMetodoEnvio: z.number(),
      codigo: z.string(),
      nombre: z.string(),
      diasMin: z.number(),
      diasMax: z.number(),
      tarifa: z.string(),
      costo: z.string(),
      envioGratis: z.boolean(),
    }),
  ),
  envioGratis: z
    .strictObject({ montoMinimo: z.string(), faltante: z.string(), alcanzado: z.boolean() })
    .nullable(),
});

let tokenAdmin: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

const metodos = async (comprador: Comprador) =>
  leerDatos(await request(app).get('/api/v1/envios/metodos').set(comprador), metodosSchema);

async function cuponDeMontoFijo(valor: string): Promise<{ codigo: string; idCupon: number }> {
  const codigo = `E${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/cupones')
    .set(comoCliente(tokenAdmin))
    .send({
      codigo,
      descripcion: 'Cupón de envíos',
      tipo: 'MontoFijo',
      valor,
      fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
      fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
      limiteUsosTotal: 5,
    });
  return { codigo, idCupon: leerDatos(respuesta, z.object({ idCupon: z.number() })).idCupon };
}

describe('métodos de envío para el carrito (E4-H06, N-04)', () => {
  it('sin carrito, cada método cuesta su tarifa y falta todo el mínimo para el envío gratis', async () => {
    const respuesta = await metodos(comoInvitado());

    expect(respuesta.metodos.map((m) => m.codigo)).toEqual(
      expect.arrayContaining(['Estandar', 'Express']),
    );
    for (const metodo of respuesta.metodos) {
      expect(metodo).toMatchObject({ costo: metodo.tarifa, envioGratis: false });
    }
    expect(respuesta.envioGratis).toEqual({
      montoMinimo: '500.00',
      faltante: '500.00',
      alcanzado: false,
    });
  });

  it('el envío gratis se evalúa sobre el subtotal después del cupón', async () => {
    const { IDVariante } = await varianteVendible('520.00', 5);
    const { token } = await invitadoConCarrito(app, IDVariante);

    const sinCupon = await metodos(comoInvitado(token));
    const conCupon = leerCarrito(
      await request(app)
        .put('/api/v1/carrito/cupon')
        .set(comoInvitado(token))
        .send({ codigo: (await cuponDeMontoFijo('30.00')).codigo }),
    );
    const despues = await metodos(comoInvitado(token));

    expect(sinCupon.metodos.every((m) => m.costo === '0.00' && m.envioGratis)).toBe(true);
    expect(sinCupon.envioGratis).toMatchObject({ faltante: '0.00', alcanzado: true });
    expect(conCupon.resumen).toMatchObject({
      total: '490.00',
      envioGratis: { montoMinimo: '500.00', faltante: '10.00', alcanzado: false },
    });
    expect(despues.metodos.every((m) => m.costo === m.tarifa && !m.envioGratis)).toBe(true);
    expect(despues.envioGratis).toMatchObject({ faltante: '10.00', alcanzado: false });
  });

  it('un cupón que dejó de ser válido no cuenta para el envío gratis', async () => {
    const { IDVariante } = await varianteVendible('520.00', 5);
    const { token } = await invitadoConCarrito(app, IDVariante);
    const { codigo, idCupon } = await cuponDeMontoFijo('30.00');
    await request(app).put('/api/v1/carrito/cupon').set(comoInvitado(token)).send({ codigo });
    const conCupon = await metodos(comoInvitado(token));

    await request(app)
      .post(`/api/v1/admin/cupones/${String(idCupon)}/desactivar`)
      .set(comoCliente(tokenAdmin));
    const sinCupon = await metodos(comoInvitado(token));

    expect(conCupon.envioGratis).toMatchObject({ faltante: '10.00', alcanzado: false });
    expect(sinCupon.envioGratis).toMatchObject({ faltante: '0.00', alcanzado: true });
    expect(sinCupon.metodos.every((m) => m.costo === '0.00')).toBe(true);
  });

  it('con sesión de cliente usa su carrito', async () => {
    const { IDVariante } = await varianteVendible('250.00', 5);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante, 2);

    const respuesta = await metodos(comoCliente(cliente.token));

    expect(respuesta.envioGratis).toMatchObject({ faltante: '0.00', alcanzado: true });
  });

  it('un token inválido responde 401', async () => {
    const respuesta = await request(app)
      .get('/api/v1/envios/metodos')
      .set(comoCliente('no-es-un-token'));

    expect(respuesta.status).toBe(401);
  });
});
