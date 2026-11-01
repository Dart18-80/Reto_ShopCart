import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { leerBitacora } from '../datos-de-prueba.js';
import {
  conToken,
  crearAtributo,
  crearCategoria,
  crearProducto,
  crearVariante,
  productoAdminSchema,
  tokenDeAdmin,
} from './apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const productoNuevo = async () =>
  (await crearProducto(app, token, await crearCategoria(app, token))).idProducto;

describe('casos borde del catálogo: entradas', () => {
  it('el precio acepta 10 enteros y 2 decimales; uno más, negativo, con exponente o como número responde 400', async () => {
    const idProducto = await productoNuevo();

    const maximo = await crearVariante(app, token, idProducto, [], { precio: '9999999999.99' });
    const rechazados = await Promise.all(
      ['10000000000.00', '-5.00', '1e3', 12.5].map((precio) =>
        crearVariante(app, token, idProducto, [], { precio }),
      ),
    );

    expect(leerDatos(maximo, productoAdminSchema).variantes[0]?.precio).toBe('9999999999.99');
    expect(rechazados.map((r) => r.status)).toEqual([400, 400, 400, 400]);
  });

  it('valores de atributo que no son enteros positivos o un objeto en lugar de arreglo responden 400', async () => {
    const idProducto = await productoNuevo();

    const respuestas = await Promise.all(
      [['1'], [1.5], [0], [-3], { 0: 1 }].map((valores) =>
        crearVariante(app, token, idProducto, [], { valores }),
      ),
    );

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
  });

  it('un nombre de producto de 150 unidades UTF-16 con emojis se guarda completo; 151 responde 400', async () => {
    const idCategoria = await crearCategoria(app, token);
    const exacto = `${'😀'.repeat(74)}ab`;

    const aceptado = await request(app)
      .post('/api/v1/admin/productos')
      .set(conToken(token))
      .send({ idCategoria, nombre: exacto });
    const largo = await request(app)
      .post('/api/v1/admin/productos')
      .set(conToken(token))
      .send({ idCategoria, nombre: `${exacto}c` });

    expect(leerDatos(aceptado, productoAdminSchema).nombre).toBe(exacto);
    expect(largo.status).toBe(400);
  });

  it('un cuerpo con __proto__ o un arreglo en lugar de objeto responde 400', async () => {
    const respuestas = await Promise.all([
      request(app)
        .post('/api/v1/admin/productos')
        .set(conToken(token))
        .set('Content-Type', 'application/json')
        .send('{"idCategoria":1,"nombre":"X","__proto__":{"activo":false}}'),
      request(app)
        .post('/api/v1/admin/productos')
        .set(conToken(token))
        .send([{ nombre: 'X' }]),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400]);
    expect(({} as Record<string, unknown>).activo).toBeUndefined();
  });

  it('la búsqueda rechaza un texto de 151 caracteres, una categoría no numérica y una página 0', async () => {
    const respuestas = await Promise.all([
      request(app)
        .get('/api/v1/productos')
        .query({ texto: 'x'.repeat(151) }),
      request(app).get('/api/v1/productos').query({ categoria: 'ropa' }),
      request(app).get('/api/v1/productos').query({ pagina: '0' }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400]);
  });
});

describe('casos borde del catálogo: base de datos', () => {
  it('borrar un producto con varias variantes registra en la bitácora la eliminación de cada una', async () => {
    const talla = await crearAtributo(app, token, ['S', 'M', 'L']);
    const idProducto = await productoNuevo();
    const ids: number[] = [];
    for (const valor of ['S', 'M', 'L']) {
      const detalle = leerDatos(
        await crearVariante(app, token, idProducto, [talla.valores[valor] ?? 0]),
        productoAdminSchema,
      );
      ids.push(detalle.variantes.at(-1)?.idVariante ?? 0);
    }

    await request(app)
      .delete(`/api/v1/admin/productos/${String(idProducto)}`)
      .set(conToken(token));

    for (const idVariante of ids) {
      const acciones = (await leerBitacora('Variante', idVariante)).map((fila) => fila.Accion);
      expect(acciones).toContain('Eliminar');
    }
  });
});
