import express, { type Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { manejadorErrores } from '../../../../src/shared/errors/middleware.js';
import { manejar } from '../../../../src/shared/http/manejar.js';
import { requestId } from '../../../../src/shared/http/request-id.js';
import { consultaPaginacionSchema } from '../../../../src/shared/http/paginacion.js';
import { leerDatos, leerError } from '../../respuestas.js';

const LARGO_MAXIMO_NOMBRE = 10;

// Un esquema representativo de los que tendrán los módulos: entero con rango, texto recortado con largo.
const lineaSchema = z
  .object({
    cantidad: z.number().int().min(1).max(99),
    nombre: z.string().trim().min(1).max(LARGO_MAXIMO_NOMBRE),
  })
  .strict();

const lineaRecibidaSchema = z.object({ cantidad: z.number(), nombre: z.string() });

function crearAppDePrueba(): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post(
    '/lineas',
    manejar({ body: lineaSchema }, (entrada, res) => {
      res.json({ datos: entrada.body });
    }),
  );
  app.get(
    '/listado',
    manejar({ query: consultaPaginacionSchema }, (entrada, res) => {
      res.json({ datos: entrada.query });
    }),
  );
  app.post(
    '/falla',
    manejar({ body: lineaSchema }, () => Promise.reject(new Error('fallo del servicio'))),
  );
  app.use(manejadorErrores(pino({ level: 'silent' })));
  return app;
}

function enviarJson(cuerpo: string) {
  return request(crearAppDePrueba())
    .post('/lineas')
    .set('Content-Type', 'application/json')
    .send(cuerpo);
}

function enviarLinea(cuerpo: unknown) {
  return enviarJson(JSON.stringify(cuerpo));
}

describe('entradas inválidas en manejar (A-20)', () => {
  it('un body vacío responde 400 VALIDACION_FALLIDA', async () => {
    const respuesta = await request(crearAppDePrueba()).post('/lineas');

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });

  it.each(['null', '"texto"', '42', 'true'])(
    'un JSON que no es objeto ni arreglo (%s) responde 400 JSON_INVALIDO',
    async (cuerpo) => {
      const respuesta = await enviarJson(cuerpo);

      expect(respuesta.status).toBe(400);
      expect(leerError(respuesta).codigo).toBe('JSON_INVALIDO');
    },
  );

  it('un arreglo en lugar de un objeto responde 400 VALIDACION_FALLIDA', async () => {
    const respuesta = await enviarLinea([{ cantidad: 1, nombre: 'Gorra' }]);

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });

  it.each([
    ['un texto en lugar de número', '5'],
    ['cero', 0],
    ['un negativo', -1],
    ['un decimal', 1.5],
    ['uno más que el máximo', 100],
    ['null', null],
    ['un objeto', { valor: 1 }],
  ])('cantidad con %s responde 400', async (_caso, cantidad) => {
    const respuesta = await enviarLinea({ cantidad, nombre: 'Gorra' });

    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(leerError(respuesta).detalles)).toContain('body.cantidad');
  });

  it.each([1, 99])('cantidad en el límite exacto (%i) se acepta', async (cantidad) => {
    const respuesta = await enviarLinea({ cantidad, nombre: 'Gorra' });

    expect(respuesta.status).toBe(200);
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['uno más que el máximo', 'x'.repeat(LARGO_MAXIMO_NOMBRE + 1)],
  ])('nombre %s responde 400', async (_caso, nombre) => {
    const respuesta = await enviarLinea({ cantidad: 1, nombre });

    expect(respuesta.status).toBe(400);
  });

  it('un nombre con espacios alrededor llega recortado al handler', async () => {
    const respuesta = await enviarLinea({ cantidad: 1, nombre: '  Gorra  ' });

    expect(leerDatos(respuesta, lineaRecibidaSchema).nombre).toBe('Gorra');
  });

  it('acepta un nombre con el largo máximo exacto, con tildes y ñ', async () => {
    const nombre = 'Camión ñan';

    const respuesta = await enviarLinea({ cantidad: 1, nombre });

    expect(nombre).toHaveLength(LARGO_MAXIMO_NOMBRE);
    expect(leerDatos(respuesta, lineaRecibidaSchema).nombre).toBe(nombre);
  });

  // Riesgo abierto: Zod cuenta puntos de código y NVARCHAR(n) cuenta unidades UTF-16. Un texto que
  // pasa .max(n) con emojis puede exceder el parámetro del SP (error 8016 → 500).
  it('Zod cuenta un emoji como 1 carácter aunque en UTF-16 ocupe 2', async () => {
    const nombre = `${'x'.repeat(LARGO_MAXIMO_NOMBRE - 1)}🙂`;

    const respuesta = await enviarLinea({ cantidad: 1, nombre });

    expect(nombre).toHaveLength(LARGO_MAXIMO_NOMBRE + 1);
    expect(respuesta.status).toBe(200);
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'una clave peligrosa (%s) se rechaza por .strict() y no contamina Object.prototype',
    async (clave) => {
      const cuerpo = `{"cantidad":1,"nombre":"Gorra","${clave}":{"esAdmin":true}}`;

      const respuesta = await enviarJson(cuerpo);

      expect(respuesta.status).toBe(400);
      expect(JSON.stringify(leerError(respuesta).detalles)).toContain(clave);
      expect(Object.prototype).not.toHaveProperty('esAdmin');
    },
  );

  it('un Content-Type que no es JSON responde 415 CONTENIDO_NO_SOPORTADO', async () => {
    const respuesta = await request(crearAppDePrueba())
      .post('/lineas')
      .set('Content-Type', 'text/plain')
      .send('{"cantidad":1,"nombre":"Gorra"}');

    expect(respuesta.status).toBe(415);
    expect(leerError(respuesta).codigo).toBe('CONTENIDO_NO_SOPORTADO');
  });

  it('un formulario (x-www-form-urlencoded) responde 415 CONTENIDO_NO_SOPORTADO', async () => {
    const respuesta = await request(crearAppDePrueba())
      .post('/lineas')
      .type('form')
      .send({ cantidad: '1', nombre: 'Gorra' });

    expect(respuesta.status).toBe(415);
  });

  it('un handler que rechaza su promesa termina en 500 ERROR_INTERNO, sin colgar la petición', async () => {
    const respuesta = await request(crearAppDePrueba())
      .post('/falla')
      .send({ cantidad: 1, nombre: 'Gorra' });

    expect(respuesta.status).toBe(500);
    expect(leerError(respuesta).codigo).toBe('ERROR_INTERNO');
  });
});

describe('query string en manejar', () => {
  it.each([
    ['repetido', 'pagina=1&pagina=2'],
    ['vacío', 'pagina='],
    ['decimal', 'pagina=1.5'],
    ['Infinity', 'pagina=Infinity'],
    ['texto', 'pagina=uno'],
    ['negativo', 'tamano=-5'],
  ])('un parámetro %s responde 400', async (_caso, consulta) => {
    const respuesta = await request(crearAppDePrueba()).get(`/listado?${consulta}`);

    expect(respuesta.status).toBe(400);
  });

  it('ignora parámetros que el esquema no declara', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/listado?pagina=2&__proto__=x');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, z.object({ pagina: z.number(), tamano: z.number() }))).toEqual({
      pagina: 2,
      tamano: 20,
    });
  });
});
