import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { conToken, crearCategoria, crearProducto, tokenDeAdmin } from './apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const RUTA = '/api/v1/admin/categorias';

const categoriaAdminSchema = z.strictObject({
  idCategoria: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  ilustracion: z.string(),
  activo: z.boolean(),
  productos: z.number(),
});

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const listar = async () =>
  leerDatos(await request(app).get(RUTA).set(conToken(token)), z.array(categoriaAdminSchema));

describe('GET /admin/categorias: todas las categorías para el Admin (M6-H02)', () => {
  it('trae las inactivas con su estado, su ilustración y cuántos productos tienen', async () => {
    const activa = await crearCategoria(app, token);
    await crearProducto(app, token, activa);
    await crearProducto(app, token, activa);
    const inactiva = await crearCategoria(app, token);
    await request(app)
      .post(`${RUTA}/${String(inactiva)}/desactivar`)
      .set(conToken(token));

    const categorias = await listar();

    expect(categorias.find((c) => c.idCategoria === activa)).toMatchObject({
      activo: true,
      ilustracion: 'Camisa',
      productos: 2,
    });
    expect(categorias.find((c) => c.idCategoria === inactiva)).toMatchObject({
      activo: false,
      productos: 0,
    });
  });

  it('un Operador recibe 403 y sin sesión 401', async () => {
    const operador = leerSesion(
      await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;

    expect((await request(app).get(RUTA).set(conToken(operador))).status).toBe(403);
    expect((await request(app).get(RUTA)).status).toBe(401);
  });
});
