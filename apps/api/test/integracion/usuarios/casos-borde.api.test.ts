import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  CONTRASENA,
  correoUnico,
  iniciarSesion,
  leerSesion,
  registrar,
} from '../auth/apoyo-auth.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const INT_MAXIMO = 2_147_483_647;

const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

async function tokenDeAdmin(): Promise<string> {
  return leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
}

describe('casos borde de la administración de usuarios (E2-H04)', () => {
  it.each([String(INT_MAXIMO + 1), 'abc', '0'])(
    'POST /usuarios/%s/desactivar responde 400',
    async (id) => {
      const respuesta = await request(app)
        .post(`/api/v1/usuarios/${id}/desactivar`)
        .set(conToken(await tokenDeAdmin()));

      expect(respuesta.status).toBe(400);
    },
  );

  it('el ID más grande de INT que no existe responde 404', async () => {
    const respuesta = await request(app)
      .patch(`/api/v1/usuarios/${String(INT_MAXIMO)}`)
      .set(conToken(await tokenDeAdmin()))
      .send({ nombre: 'Nadie' });

    expect(respuesta.status).toBe(404);
  });

  it('una página tan grande que desbordaría el OFFSET responde 400', async () => {
    const respuesta = await request(app)
      .get('/api/v1/usuarios')
      .query({ pagina: INT_MAXIMO, tamano: 100 })
      .set(conToken(await tokenDeAdmin()));

    expect(respuesta.status).toBe(400);
  });

  it('la última página que cabe en INT responde 200 con la lista vacía', async () => {
    const respuesta = await request(app)
      .get('/api/v1/usuarios')
      .query({ pagina: Math.floor(INT_MAXIMO / 100), tamano: 100 })
      .set(conToken(await tokenDeAdmin()));

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, z.array(z.unknown()))).toEqual([]);
  });

  it.each([
    ['un rol que no existe', { rol: 'Root' }],
    ['el rol Sistema', { rol: 'Sistema' }],
    ['activo con otro valor', { activo: 'si' }],
    ['tamano mayor a 100', { tamano: 101 }],
  ])('el filtro con %s responde 400', async (_caso, consulta) => {
    const respuesta = await request(app)
      .get('/api/v1/usuarios')
      .query(consulta)
      .set(conToken(await tokenDeAdmin()));

    expect(respuesta.status).toBe(400);
  });

  it('PATCH /usuarios/:id no permite asignar el rol Sistema', async () => {
    const { usuario } = leerSesion(await registrar(app));

    const respuesta = await request(app)
      .patch(`/api/v1/usuarios/${String(usuario.idUsuario)}`)
      .set(conToken(await tokenDeAdmin()))
      .send({ rol: 'Sistema' });

    expect(respuesta.status).toBe(400);
  });
});

describe('casos borde del registro y el login (E2-H01, N-15)', () => {
  it.each([
    ['solo números', '12345678'],
    ['solo letras', 'abcdefgh'],
    ['de 7 caracteres', 'Clave20'],
    ['de 129 caracteres', `a1${'x'.repeat(127)}`],
  ])('una contraseña %s responde 400', async (_caso, contrasena) => {
    const respuesta = await registrar(app, correoUnico(), contrasena);

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });

  it('acepta una contraseña de 128 caracteres con letras Unicode y espacios, y con ella inicia sesión', async () => {
    const correo = correoUnico();
    const contrasena = ` ñandú 2026 ${'é'.repeat(116)}`;

    expect((await registrar(app, correo, contrasena)).status).toBe(201);
    expect((await iniciarSesion(app, correo, contrasena)).status).toBe(200);
  });

  it('la contraseña no se recorta: con los espacios de más no inicia sesión', async () => {
    const correo = correoUnico();
    await registrar(app, correo, 'Clave 2026');

    const respuesta = await iniciarSesion(app, correo, ' Clave 2026 ');

    expect(respuesta.status).toBe(401);
  });

  it('el login acepta el correo con otras mayúsculas y espacios alrededor', async () => {
    const correo = correoUnico();
    await registrar(app, correo);

    const respuesta = await iniciarSesion(app, `  ${correo.toUpperCase()}  `, CONTRASENA);

    expect(respuesta.status).toBe(200);
  });

  it.each([
    ['sin arroba', 'cliente.shopcart.gt'],
    ['vacío', ''],
    ['de 255 caracteres', `${'a'.repeat(243)}@shopcart.gt`],
  ])('un correo %s responde 400 en el registro', async (_caso, correo) => {
    expect((await registrar(app, correo)).status).toBe(400);
  });

  it('un login con la contraseña de un tipo equivocado responde 400, no 500', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: 'admin@shopcart.gt', contrasena: ['Admin2026!'] });

    expect(respuesta.status).toBe(400);
  });

  it('un login en texto plano (Content-Type equivocado) responde 415', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('correo=admin@shopcart.gt&contrasena=Admin2026!');

    expect(respuesta.status).toBe(415);
  });
});
