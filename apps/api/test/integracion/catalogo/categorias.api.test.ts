import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { leerBitacora } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const RUTA_ADMIN = '/api/v1/admin/categorias';
const ID_INEXISTENTE = 2_147_483_647;

const categoriaSchema = z.object({
  idCategoria: z.number(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
});
const publicaSchema = z.array(
  z.object({ idCategoria: z.number(), nombre: z.string(), descripcion: z.string().nullable() }),
);

let tokenAdmin: string;
const conAdmin = () => ({ Authorization: `Bearer ${tokenAdmin}` });

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

const nombreUnico = () => `Categoría ${randomUUID().slice(0, 8)}`;

async function crearCategoria(cambios: Record<string, unknown> = {}) {
  const respuesta = await request(app)
    .post(RUTA_ADMIN)
    .set(conAdmin())
    .send({ nombre: nombreUnico(), ...cambios });
  return leerDatos(respuesta, categoriaSchema);
}

function crearProducto(idCategoria: number, activo: boolean) {
  return request(app)
    .post('/api/v1/admin/productos')
    .set(conAdmin())
    .send({ idCategoria, nombre: `Producto ${randomUUID().slice(0, 8)}`, activo });
}

const ruta = (idCategoria: number, accion?: string) =>
  `${RUTA_ADMIN}/${String(idCategoria)}${accion === undefined ? '' : `/${accion}`}`;

describe('GET /categorias (E3-H01, RF-02)', () => {
  it('es público y solo lista las categorías activas', async () => {
    const activa = await crearCategoria({ descripcion: 'Ropa de verano' });
    const inactiva = await crearCategoria();
    await request(app).post(ruta(inactiva.idCategoria, 'desactivar')).set(conAdmin());

    const lista = leerDatos(await request(app).get('/api/v1/categorias'), publicaSchema);

    expect(lista).toContainEqual({
      idCategoria: activa.idCategoria,
      nombre: activa.nombre,
      descripcion: 'Ropa de verano',
    });
    expect(lista.map((c) => c.idCategoria)).not.toContain(inactiva.idCategoria);
  });
});

describe('administración de categorías (E3-H01, N-14)', () => {
  it('el Admin crea una categoría activa, con el nombre recortado', async () => {
    const nombre = nombreUnico();

    const respuesta = await request(app)
      .post(RUTA_ADMIN)
      .set(conAdmin())
      .send({ nombre: `  ${nombre}  `, descripcion: 'Frescas' });

    expect(respuesta.status).toBe(201);
    expect(leerDatos(respuesta, categoriaSchema)).toMatchObject({
      nombre,
      descripcion: 'Frescas',
      activo: true,
    });
  });

  it('un nombre repetido, aunque cambien las mayúsculas, responde 409 NOMBRE_DUPLICADO', async () => {
    const existente = await crearCategoria();

    const respuesta = await request(app)
      .post(RUTA_ADMIN)
      .set(conAdmin())
      .send({ nombre: existente.nombre.toUpperCase() });

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('NOMBRE_DUPLICADO');
  });

  it('dos altas simultáneas con el mismo nombre: una crea y la otra 409, nunca 500', async () => {
    const nombre = nombreUnico();
    const alta = () => request(app).post(RUTA_ADMIN).set(conAdmin()).send({ nombre });

    const estados = (await Promise.all([alta(), alta()])).map((respuesta) => respuesta.status);

    expect(estados.sort()).toEqual([201, 409]);
  });

  it('PATCH cambia el nombre, conserva lo que no llega y quita la descripción con null', async () => {
    const categoria = await crearCategoria({ descripcion: 'Antes' });
    const nombre = nombreUnico();

    const renombrada = await request(app)
      .patch(ruta(categoria.idCategoria))
      .set(conAdmin())
      .send({ nombre });
    const sinDescripcion = await request(app)
      .patch(ruta(categoria.idCategoria))
      .set(conAdmin())
      .send({ descripcion: null });

    expect(leerDatos(renombrada, categoriaSchema)).toMatchObject({ nombre, descripcion: 'Antes' });
    expect(leerDatos(sinDescripcion, categoriaSchema)).toMatchObject({ nombre, descripcion: null });
  });

  it('PATCH con el nombre de otra categoría responde 409, uno vacío 400 y una inexistente 404', async () => {
    const [una, otra] = [await crearCategoria(), await crearCategoria()];

    const repetido = await request(app)
      .patch(ruta(una.idCategoria))
      .set(conAdmin())
      .send({ nombre: otra.nombre });
    const vacio = await request(app).patch(ruta(una.idCategoria)).set(conAdmin()).send({});
    const inexistente = await request(app)
      .patch(ruta(ID_INEXISTENTE))
      .set(conAdmin())
      .send({ nombre: nombreUnico() });

    expect(leerError(repetido).codigo).toBe('NOMBRE_DUPLICADO');
    expect(vacio.status).toBe(400);
    expect(inexistente.status).toBe(404);
  });

  it('N-14: no se desactiva con productos activos (409 CATEGORIA_CON_PRODUCTOS)', async () => {
    const categoria = await crearCategoria();
    await crearProducto(categoria.idCategoria, true);

    const respuesta = await request(app)
      .post(ruta(categoria.idCategoria, 'desactivar'))
      .set(conAdmin());

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('CATEGORIA_CON_PRODUCTOS');
    const publica = leerDatos(await request(app).get('/api/v1/categorias'), publicaSchema);
    expect(publica.map((c) => c.idCategoria)).toContain(categoria.idCategoria);
  });

  it('N-14: con productos solo inactivos sí se desactiva, y se vuelve a activar', async () => {
    const categoria = await crearCategoria();
    await crearProducto(categoria.idCategoria, false);

    const desactivada = await request(app)
      .post(ruta(categoria.idCategoria, 'desactivar'))
      .set(conAdmin());
    const activada = await request(app)
      .post(ruta(categoria.idCategoria, 'activar'))
      .set(conAdmin());

    expect(leerDatos(desactivada, categoriaSchema).activo).toBe(false);
    expect(leerDatos(activada, categoriaSchema).activo).toBe(true);
  });

  it('N-14: no se borra con productos, aunque estén inactivos (409 CATEGORIA_CON_PRODUCTOS)', async () => {
    const categoria = await crearCategoria();
    await crearProducto(categoria.idCategoria, false);

    const respuesta = await request(app).delete(ruta(categoria.idCategoria)).set(conAdmin());

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('CATEGORIA_CON_PRODUCTOS');
  });

  it('sin productos se borra (204), una segunda vez responde 404 y la bitácora registra la eliminación', async () => {
    const categoria = await crearCategoria();

    const respuesta = await request(app).delete(ruta(categoria.idCategoria)).set(conAdmin());
    const otraVez = await request(app).delete(ruta(categoria.idCategoria)).set(conAdmin());

    expect(respuesta.status).toBe(204);
    expect(otraVez.status).toBe(404);
    const acciones = (await leerBitacora('Categoria', categoria.idCategoria)).map((f) => f.Accion);
    expect(acciones).toContain('Eliminar');
  });

  it('RF-01: un Cliente o un Operador recibe 403 en cada ruta de administración, y sin token 401', async () => {
    const categoria = await crearCategoria();
    const cliente = leerSesion(await registrar(app)).accessToken;
    const operador = leerSesion(
      await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const intentos = (cabeceras: Record<string, string>) => [
      request(app).post(RUTA_ADMIN).set(cabeceras).send({ nombre: nombreUnico() }),
      request(app).patch(ruta(categoria.idCategoria)).set(cabeceras).send({ nombre: 'X' }),
      request(app).post(ruta(categoria.idCategoria, 'desactivar')).set(cabeceras),
      request(app).post(ruta(categoria.idCategoria, 'activar')).set(cabeceras),
      request(app).delete(ruta(categoria.idCategoria)).set(cabeceras),
    ];

    for (const token of [cliente, operador]) {
      for (const respuesta of await Promise.all(intentos({ Authorization: `Bearer ${token}` }))) {
        expect(respuesta.status).toBe(403);
      }
    }
    for (const respuesta of await Promise.all(intentos({}))) expect(respuesta.status).toBe(401);
  });

  it('un cuerpo con campos extra o un nombre de más de 80 caracteres responde 400', async () => {
    const extra = await request(app)
      .post(RUTA_ADMIN)
      .set(conAdmin())
      .send({ nombre: nombreUnico(), activo: false });
    const largo = await request(app)
      .post(RUTA_ADMIN)
      .set(conAdmin())
      .send({ nombre: 'x'.repeat(81) });

    expect(extra.status).toBe(400);
    expect(largo.status).toBe(400);
  });
});
