import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  agregar,
  cambiarCantidad,
  comoCliente,
  comoInvitado,
  invitadoConCarrito,
  leerCarrito,
  marcarAvisosVistos,
  primeraLinea,
  vencerGarantia,
  varianteVendible,
  verCarrito,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const TOLERANCIA_MS = 60_000;

let tokenOperador: string;
let tokenAdmin: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
});

async function cambiarPrecio(idVariante: number, precio: string): Promise<void> {
  const respuesta = await request(app)
    .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
    .set(comoCliente(tokenAdmin))
    .send({ precio });
  expect(respuesta.status).toBe(200);
}

/** Un invitado con una línea de 2 unidades a Q100.00. */
async function lineaGarantizada() {
  const { IDVariante } = await varianteVendible('100.00', 10);
  const { token, carrito } = await invitadoConCarrito(app, IDVariante, 2);
  return { IDVariante, token, linea: primeraLinea(carrito) };
}

const consultar = async (token: string) =>
  primeraLinea(leerCarrito(await verCarrito(app, comoInvitado(token))));

describe('garantía de precio (E4-H02, N-02)', () => {
  it('la línea queda garantizada DiasGarantiaPrecio días (3) desde que se agregó, sin aviso', async () => {
    const antes = Date.now();
    const { linea } = await lineaGarantizada();

    const plazo = Date.parse(linea.garantiaHasta) - antes;
    expect(Math.abs(plazo - 3 * MS_POR_DIA)).toBeLessThan(TOLERANCIA_MS);
    expect(linea).toMatchObject({ precioUnitario: '100.00', aviso: null });
  });

  it('con la garantía vigente, una subida no afecta la línea y muestra el aviso con la fecha', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();

    await cambiarPrecio(IDVariante, '120.00');
    const consultada = await consultar(token);

    expect(consultada).toMatchObject({
      precioUnitario: '100.00',
      totalLinea: '200.00',
      garantiaHasta: linea.garantiaHasta,
      aviso: { tipo: 'PrecioGarantizado', precioAnterior: null },
    });
  });

  it('una baja de precio se aplica de inmediato y avisa "¡Bajó de precio!"', async () => {
    const { IDVariante, token } = await lineaGarantizada();

    await cambiarPrecio(IDVariante, '80.00');
    const consultada = await consultar(token);

    expect(consultada).toMatchObject({
      precioUnitario: '80.00',
      totalLinea: '160.00',
      aviso: { tipo: 'BajoDePrecio', precioAnterior: '100.00' },
    });
  });

  it('una subida y después una baja por debajo del garantizado: rige el vigente', async () => {
    const { IDVariante, token } = await lineaGarantizada();

    await cambiarPrecio(IDVariante, '150.00');
    await cambiarPrecio(IDVariante, '90.00');

    expect(await consultar(token)).toMatchObject({
      precioUnitario: '90.00',
      aviso: { tipo: 'BajoDePrecio' },
    });
  });

  it('con la garantía vencida, la línea toma el vigente y la alerta sigue hasta marcarla como vista', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '120.00');

    await vencerGarantia(linea.idLinea);
    const primera = await consultar(token);
    const segunda = await consultar(token);
    const vistos = primeraLinea(leerCarrito(await marcarAvisosVistos(app, comoInvitado(token))));
    const despues = await consultar(token);

    const alerta = { tipo: 'CambioDePrecio', precioAnterior: '100.00' };
    expect(primera).toMatchObject({
      precioUnitario: '120.00',
      totalLinea: '240.00',
      aviso: alerta,
    });
    expect(segunda.aviso).toEqual(alerta);
    expect(vistos).toMatchObject({ precioUnitario: '120.00', aviso: null });
    expect(despues).toMatchObject({ precioUnitario: '120.00', aviso: null });
  });

  it('vencida, un cambio posterior vuelve a avisar desde el último precio que el cliente vio', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '120.00');
    await vencerGarantia(linea.idLinea);
    await consultar(token);
    await marcarAvisosVistos(app, comoInvitado(token));

    await cambiarPrecio(IDVariante, '130.00');

    expect(await consultar(token)).toMatchObject({
      precioUnitario: '130.00',
      aviso: { tipo: 'CambioDePrecio', precioAnterior: '120.00' },
    });
  });

  it('vencida con una baja de precio: toma el vigente y avisa el cambio hasta marcarlo como visto', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '70.00');

    await vencerGarantia(linea.idLinea);
    const consultada = await consultar(token);
    const vistos = primeraLinea(leerCarrito(await marcarAvisosVistos(app, comoInvitado(token))));

    expect(consultada).toMatchObject({
      precioUnitario: '70.00',
      aviso: { tipo: 'CambioDePrecio', precioAnterior: '100.00' },
    });
    expect(vistos).toMatchObject({ precioUnitario: '70.00', aviso: null });
  });

  it('vencida con una alerta sin ver: si el precio vuelve al registrado, la alerta desaparece', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '120.00');
    await vencerGarantia(linea.idLinea);
    await consultar(token);

    await cambiarPrecio(IDVariante, '100.00');

    expect(await consultar(token)).toMatchObject({ precioUnitario: '100.00', aviso: null });
  });

  it('vencida sin cambio de precio: nada cambia ni avisa', async () => {
    const { token, linea } = await lineaGarantizada();

    await vencerGarantia(linea.idLinea);

    expect(await consultar(token)).toMatchObject({ precioUnitario: '100.00', aviso: null });
  });

  it('cambiar la cantidad (PATCH o sumar) no renueva la garantía ni el precio', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '120.00');

    const cambio = primeraLinea(
      leerCarrito(await cambiarCantidad(app, comoInvitado(token), linea.idLinea, 3)),
    );
    const suma = primeraLinea(leerCarrito(await agregar(app, comoInvitado(token), IDVariante, 1)));

    for (const consultada of [cambio, suma]) {
      expect(consultada.garantiaHasta).toBe(linea.garantiaHasta);
      expect(consultada.precioUnitario).toBe('100.00');
    }
    expect(suma.cantidad).toBe(4);
  });

  it('marcar los avisos de otro carrito no toca los míos', async () => {
    const { IDVariante, token, linea } = await lineaGarantizada();
    const otro = await lineaGarantizada();
    await cambiarPrecio(IDVariante, '120.00');
    await vencerGarantia(linea.idLinea);
    await consultar(token);

    await marcarAvisosVistos(app, comoInvitado(otro.token));

    expect((await consultar(token)).aviso).toMatchObject({ tipo: 'CambioDePrecio' });
  });

  it('sin carrito, marcar los avisos responde un carrito vacío', async () => {
    const respuesta = await marcarAvisosVistos(app, comoInvitado());

    expect(respuesta.status).toBe(200);
    expect(leerCarrito(respuesta).lineas).toEqual([]);
  });

  it('el Operador recibe 403 al marcar avisos', async () => {
    const respuesta = await marcarAvisosVistos(app, comoCliente(tokenOperador));

    expect(respuesta.status).toBe(403);
  });
});
