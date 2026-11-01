import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { crearVariante } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let token: string;

beforeAll(async () => {
  token = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!')).accessToken;
});

const conOperador = () => ({ Authorization: `Bearer ${token}` });

describe('casos borde de inventario: entradas', () => {
  it('cantidades decimales, como texto, en 0, negativas en una entrada o por encima del tope responden 400', async () => {
    const { IDVariante: idVariante } = await crearVariante();
    const entrada = (cantidad: unknown) =>
      request(app)
        .post('/api/v1/inventario/entradas')
        .set(conOperador())
        .send({ idVariante, cantidad, motivo: 'Compra' });

    const respuestas = await Promise.all(
      [1.5, '3', 0, -2, 1_000_001].map((cantidad) => entrada(cantidad)),
    );

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
  });

  it('un motivo de 250 unidades UTF-16 se acepta; 251 responde 400', async () => {
    const { IDVariante: idVariante } = await crearVariante();
    const exacto = `${'ñ'.repeat(248)}😀`;
    const ajuste = (motivo: string) =>
      request(app)
        .post('/api/v1/inventario/ajustes')
        .set(conOperador())
        .send({ idVariante, cantidad: 1, motivo });

    expect((await ajuste(exacto)).status).toBe(201);
    expect((await ajuste(`${exacto}x`)).status).toBe(400);
  });

  it('un campo extra o una referencia en una entrada de ajuste responden 400', async () => {
    const { IDVariante: idVariante } = await crearVariante();

    const respuesta = await request(app)
      .post('/api/v1/inventario/ajustes')
      .set(conOperador())
      .send({ idVariante, cantidad: 1, motivo: 'X', referencia: 'FAC-1' });

    expect(respuesta.status).toBe(400);
  });

  it('el kardex con una variante no numérica o un tamaño de 101 responde 400', async () => {
    const respuestas = await Promise.all([
      request(app).get('/api/v1/inventario/kardex?variante=abc').set(conOperador()),
      request(app).get('/api/v1/inventario/kardex?variante=1&tamano=101').set(conOperador()),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400]);
  });
});
