import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const RUTA = '/api/v1/admin/atributos';
const ID_INEXISTENTE = 2_147_483_647;

const valorSchema = z.object({
  idValorAtributo: z.number(),
  idAtributo: z.number(),
  valor: z.string(),
  orden: z.number(),
});
const atributoSchema = z.object({
  idAtributo: z.number(),
  nombre: z.string(),
  orden: z.number(),
  valores: z.array(valorSchema.omit({ idAtributo: true })),
});

let tokenAdmin: string;
const conAdmin = () => ({ Authorization: `Bearer ${tokenAdmin}` });

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
});

const nombreUnico = () => `Atributo ${randomUUID().slice(0, 8)}`;

async function crearAtributo(cambios: Record<string, unknown> = {}) {
  const respuesta = await request(app)
    .post(RUTA)
    .set(conAdmin())
    .send({ nombre: nombreUnico(), ...cambios });
  return leerDatos(respuesta, atributoSchema);
}

const agregarValor = (idAtributo: number, cuerpo: Record<string, unknown>) =>
  request(app)
    .post(`${RUTA}/${String(idAtributo)}/valores`)
    .set(conAdmin())
    .send(cuerpo);

describe('atributos y valores (E3-H02, N-14)', () => {
  it('el Admin crea un atributo sin valores, con el orden pedido', async () => {
    const nombre = nombreUnico();

    const respuesta = await request(app).post(RUTA).set(conAdmin()).send({ nombre, orden: 7 });

    expect(respuesta.status).toBe(201);
    expect(leerDatos(respuesta, atributoSchema)).toMatchObject({ nombre, orden: 7, valores: [] });
  });

  it('un atributo con el nombre de otro (otras mayúsculas) responde 409 NOMBRE_DUPLICADO', async () => {
    const existente = await crearAtributo();

    const respuesta = await request(app)
      .post(RUTA)
      .set(conAdmin())
      .send({ nombre: existente.nombre.toLowerCase() });

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('NOMBRE_DUPLICADO');
  });

  it('agrega valores; sin orden, cada uno va al final', async () => {
    const atributo = await crearAtributo();

    const chico = leerDatos(await agregarValor(atributo.idAtributo, { valor: 'S' }), valorSchema);
    const grande = leerDatos(await agregarValor(atributo.idAtributo, { valor: 'L' }), valorSchema);

    expect(chico).toMatchObject({ idAtributo: atributo.idAtributo, valor: 'S' });
    expect(grande.orden).toBeGreaterThan(chico.orden);
  });

  it('CA: un valor repetido dentro del mismo atributo responde 409 NOMBRE_DUPLICADO', async () => {
    const atributo = await crearAtributo();
    await agregarValor(atributo.idAtributo, { valor: 'Azul' });

    const respuesta = await agregarValor(atributo.idAtributo, { valor: 'azul' });

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('NOMBRE_DUPLICADO');
  });

  it('el mismo valor en otro atributo sí se acepta', async () => {
    const [color, tono] = [await crearAtributo(), await crearAtributo()];
    await agregarValor(color.idAtributo, { valor: 'Azul' });

    expect((await agregarValor(tono.idAtributo, { valor: 'Azul' })).status).toBe(201);
  });

  it('dos valores iguales a la vez en el mismo atributo: uno se crea y el otro 409, nunca 500', async () => {
    const atributo = await crearAtributo();

    const estados = (
      await Promise.all([
        agregarValor(atributo.idAtributo, { valor: 'XL' }),
        agregarValor(atributo.idAtributo, { valor: 'XL' }),
      ])
    ).map((respuesta) => respuesta.status);

    expect(estados.sort()).toEqual([201, 409]);
  });

  it('un valor en un atributo inexistente responde 404', async () => {
    expect((await agregarValor(ID_INEXISTENTE, { valor: 'M' })).status).toBe(404);
  });

  it('GET lista cada atributo con sus valores en orden', async () => {
    const atributo = await crearAtributo();
    await agregarValor(atributo.idAtributo, { valor: 'Grande', orden: 2 });
    await agregarValor(atributo.idAtributo, { valor: 'Chico', orden: 1 });

    const lista = leerDatos(await request(app).get(RUTA).set(conAdmin()), z.array(atributoSchema));

    const listado = lista.find((a) => a.idAtributo === atributo.idAtributo);
    expect(listado?.valores.map((v) => v.valor)).toEqual(['Chico', 'Grande']);
  });

  it('un orden negativo, un valor vacío o un campo extra responde 400', async () => {
    const atributo = await crearAtributo();

    const respuestas = await Promise.all([
      request(app).post(RUTA).set(conAdmin()).send({ nombre: nombreUnico(), orden: -1 }),
      agregarValor(atributo.idAtributo, { valor: '   ' }),
      agregarValor(atributo.idAtributo, { valor: 'M', idAtributo: 1 }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400]);
  });

  it('RF-01: un Cliente o un Operador recibe 403 y sin token 401', async () => {
    const atributo = await crearAtributo();
    const cliente = leerSesion(await registrar(app)).accessToken;
    const operador = leerSesion(
      await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const intentos = (cabeceras: Record<string, string>) => [
      request(app).get(RUTA).set(cabeceras),
      request(app).post(RUTA).set(cabeceras).send({ nombre: nombreUnico() }),
      request(app)
        .post(`${RUTA}/${String(atributo.idAtributo)}/valores`)
        .set(cabeceras)
        .send({ valor: 'M' }),
    ];

    for (const token of [cliente, operador]) {
      for (const respuesta of await Promise.all(intentos({ Authorization: `Bearer ${token}` }))) {
        expect(respuesta.status).toBe(403);
      }
    }
    for (const respuesta of await Promise.all(intentos({}))) expect(respuesta.status).toBe(401);
  });
});
