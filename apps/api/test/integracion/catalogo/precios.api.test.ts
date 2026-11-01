import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { leerBitacora } from '../datos-de-prueba.js';
import {
  conToken,
  crearCategoria,
  crearProducto,
  crearVariante,
  productoAdminSchema,
  tokenDeAdmin,
} from './apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const ID_INEXISTENTE = 2_147_483_647;

const historialSchema = z.array(
  z.object({
    idPrecioVariante: z.number(),
    precio: z.string(),
    vigenteDesde: z.string(),
    vigenteHasta: z.string().nullable(),
    usuario: z.object({ idUsuario: z.number(), nombre: z.string() }),
  }),
);

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

async function varianteNueva(precio = '100.00') {
  const producto = await crearProducto(app, token, await crearCategoria(app, token));
  const detalle = leerDatos(
    await crearVariante(app, token, producto.idProducto, [], { precio }),
    productoAdminSchema,
  );
  return { idProducto: producto.idProducto, idVariante: detalle.variantes[0]?.idVariante ?? 0 };
}

const cambiarPrecio = (idVariante: number, precio: string, credencial = token) =>
  request(app)
    .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
    .set(conToken(credencial))
    .send({ precio });

const historial = async (idVariante: number) =>
  leerDatos(
    await request(app)
      .get(`/api/v1/admin/variantes/${String(idVariante)}/precios`)
      .set(conToken(token)),
    historialSchema,
  );

describe('precios versionados (E3-H04, N-02)', () => {
  it('cierra la versión vigente e inserta la nueva; el historial va de la más reciente a la más antigua', async () => {
    const { idProducto, idVariante } = await varianteNueva('100.00');

    const respuesta = await cambiarPrecio(idVariante, '89.50');

    const versiones = leerDatos(respuesta, historialSchema);
    expect(versiones.map((v) => [v.precio, v.vigenteHasta === null])).toEqual([
      ['89.50', true],
      ['100.00', false],
    ]);
    expect(versiones[1]?.vigenteHasta).toBe(versiones[0]?.vigenteDesde);
    const producto = leerDatos(
      await request(app)
        .get(`/api/v1/admin/productos/${String(idProducto)}`)
        .set(conToken(token)),
      productoAdminSchema,
    );
    expect(producto.variantes[0]?.precio).toBe('89.50');
  });

  it('CA: cinco cambios simultáneos dejan exactamente un precio vigente y seis versiones sin huecos', async () => {
    const { idVariante } = await varianteNueva();
    const precios = ['10.00', '20.00', '30.00', '40.00', '50.00'];

    const respuestas = await Promise.all(
      precios.map((precio) => cambiarPrecio(idVariante, precio)),
    );

    expect(respuestas.map((r) => r.status)).toEqual(precios.map(() => 200));
    const versiones = await historial(idVariante);
    expect(versiones).toHaveLength(precios.length + 1);
    expect(versiones.filter((v) => v.vigenteHasta === null)).toHaveLength(1);
    // Cada versión cerrada termina exactamente donde empieza la siguiente.
    for (let i = 1; i < versiones.length; i++) {
      expect(versiones[i]?.vigenteHasta).toBe(versiones[i - 1]?.vigenteDesde);
    }
  });

  it('CA: la bitácora registra la nueva versión con el precio anterior y el nuevo (R5)', async () => {
    const { idVariante } = await varianteNueva('100.00');

    const [nueva] = leerDatos(await cambiarPrecio(idVariante, '120.00'), historialSchema);

    const [fila] = await leerBitacora('PrecioVariante', nueva?.idPrecioVariante ?? 0);
    expect(fila).toMatchObject({ Modulo: 'Catalogo', Accion: 'Modificar' });
    expect(JSON.parse(fila?.ValorAnterior ?? '{}')).toMatchObject({
      IDVariante: idVariante,
      Precio: 100,
    });
    expect(JSON.parse(fila?.ValorNuevo ?? '{}')).toMatchObject({
      IDVariante: idVariante,
      Precio: 120,
    });
  });

  it('un PUT con el precio vigente es idempotente: no crea versión ni fila de bitácora y responde la vigente', async () => {
    const { idVariante } = await varianteNueva('100.00');
    const [vigente] = await historial(idVariante);
    const bitacoraAntes = await leerBitacora('PrecioVariante', vigente?.idPrecioVariante ?? 0);

    const respuesta = await cambiarPrecio(idVariante, '100.00');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, historialSchema)).toEqual([vigente]);
    expect(await historial(idVariante)).toHaveLength(1);
    expect(await leerBitacora('PrecioVariante', vigente?.idPrecioVariante ?? 0)).toEqual(
      bitacoraAntes,
    );
  });

  it('un precio de cero o mal formado responde 400 y una variante inexistente 404', async () => {
    const { idVariante } = await varianteNueva();

    const respuestas = await Promise.all([
      cambiarPrecio(idVariante, '0'),
      cambiarPrecio(idVariante, '12.345'),
      cambiarPrecio(ID_INEXISTENTE, '10.00'),
      request(app)
        .get(`/api/v1/admin/variantes/${String(ID_INEXISTENTE)}/precios`)
        .set(conToken(token)),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 404, 404]);
    expect(respuestas.slice(2).map((r) => leerError(r).codigo)).toEqual([
      'NO_ENCONTRADO',
      'NO_ENCONTRADO',
    ]);
  });

  it('RF-01: un Cliente o un Operador recibe 403 y sin token 401', async () => {
    const { idVariante } = await varianteNueva();
    const cliente = leerSesion(await registrar(app)).accessToken;
    const operador = leerSesion(
      await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const intentos = (cabeceras: Record<string, string>) => [
      request(app)
        .put(`/api/v1/admin/variantes/${String(idVariante)}/precio`)
        .set(cabeceras)
        .send({ precio: '1.00' }),
      request(app)
        .get(`/api/v1/admin/variantes/${String(idVariante)}/precios`)
        .set(cabeceras),
    ];

    for (const credencial of [cliente, operador]) {
      for (const respuesta of await Promise.all(intentos(conToken(credencial)))) {
        expect(respuesta.status).toBe(403);
      }
    }
    for (const respuesta of await Promise.all(intentos({}))) expect(respuesta.status).toBe(401);
  });
});
