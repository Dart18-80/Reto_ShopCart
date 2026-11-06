import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  conToken,
  crearCategoria,
  crearProducto,
  crearVariante,
  tokenDeAdmin,
} from '../catalogo/apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const existencias = async (texto: string) =>
  leerDatos(
    await request(app)
      .get(
        `/api/v1/inventario/existencias?${new URLSearchParams({ texto, tamano: '100' }).toString()}`,
      )
      .set(conToken(token)),
    z.array(z.object({ idVariante: z.number(), sku: z.string(), producto: z.string() })),
  );

async function camison() {
  const marca = randomUUID().slice(0, 8);
  const sku = `CMS${marca.toUpperCase()}-M`;
  const { idProducto } = await crearProducto(app, token, await crearCategoria(app, token), {
    nombre: `Camisón ${marca}`,
  });
  await crearVariante(app, token, idProducto, [], { sku });
  return { marca, sku };
}

describe('existencias con búsqueda (M7-H01)', () => {
  it('«CAMISON» encuentra «Camisón»: sin tildes ni mayúsculas, como la búsqueda de la tienda', async () => {
    const { marca, sku } = await camison();

    expect((await existencias(`CAMISON ${marca}`)).map((e) => e.sku)).toEqual([sku]);
  });

  it('un SKU se encuentra por su prefijo', async () => {
    const { sku } = await camison();

    expect((await existencias(sku.slice(0, 9).toLowerCase())).map((e) => e.sku)).toContain(sku);
  });

  it('el texto se busca literal: un comodín no trae todo', async () => {
    await camison();

    expect(await existencias(`%${randomUUID().slice(0, 6)}`)).toEqual([]);
  });

  it('un texto de más de 150 caracteres responde 400', async () => {
    const respuesta = await request(app)
      .get(`/api/v1/inventario/existencias?texto=${'x'.repeat(151)}`)
      .set(conToken(token));

    expect(respuesta.status).toBe(400);
  });
});
