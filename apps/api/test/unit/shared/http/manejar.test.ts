import express, { type Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { manejadorErrores } from '../../../../src/shared/errors/middleware.js';
import { manejar } from '../../../../src/shared/http/manejar.js';
import { requestId } from '../../../../src/shared/http/request-id.js';
import { leerDatos, leerError } from '../../respuestas.js';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const cuerpoSchema = z.object({ nombre: z.string().min(1) }).strict();
const consultaSchema = z.object({ pagina: z.coerce.number().int().min(1).default(1) });

const entradaRecibidaSchema = z.object({
  params: z.object({ id: z.number() }),
  body: z.object({ nombre: z.string() }),
  query: z.object({ pagina: z.number() }),
});

const editar = manejar(
  { params: paramsSchema, body: cuerpoSchema, query: consultaSchema },
  (entrada, res) => {
    res.json({ datos: entrada });
  },
);

function crearAppDePrueba(): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.put('/recursos/:id', editar);
  app.use(manejadorErrores(pino({ level: 'silent' })));
  return app;
}

function camposConError(detalles: unknown): string[] {
  const { errores } = z
    .object({ errores: z.array(z.object({ campo: z.string() })) })
    .parse(detalles);
  return errores.map((error) => error.campo);
}

describe('manejar (A-20)', () => {
  it('entrega al handler params, body y query ya validados y transformados por Zod', async () => {
    const respuesta = await request(crearAppDePrueba())
      .put('/recursos/7?pagina=3')
      .send({ nombre: 'Ana' });

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, entradaRecibidaSchema)).toEqual({
      params: { id: 7 },
      body: { nombre: 'Ana' },
      query: { pagina: 3 },
    });
  });

  it('aplica los valores por defecto de los esquemas', async () => {
    const respuesta = await request(crearAppDePrueba()).put('/recursos/7').send({ nombre: 'Ana' });

    expect(leerDatos(respuesta, entradaRecibidaSchema).query).toEqual({ pagina: 1 });
  });

  it('un params inválido responde 400 VALIDACION_FALLIDA con el campo', async () => {
    const respuesta = await request(crearAppDePrueba())
      .put('/recursos/abc')
      .send({ nombre: 'Ana' });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(error.codigo).toBe('VALIDACION_FALLIDA');
    expect(camposConError(error.detalles)).toEqual(['params.id']);
  });

  it('un body inválido responde 400 VALIDACION_FALLIDA con el campo', async () => {
    const respuesta = await request(crearAppDePrueba()).put('/recursos/7').send({ nombre: '' });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(camposConError(error.detalles)).toEqual(['body.nombre']);
  });

  it('una query inválida responde 400 VALIDACION_FALLIDA con el campo', async () => {
    const respuesta = await request(crearAppDePrueba())
      .put('/recursos/7?pagina=0')
      .send({ nombre: 'Ana' });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(camposConError(error.detalles)).toEqual(['query.pagina']);
  });

  it('RF-01: un campo extra en el body (por ejemplo, idUsuario) se rechaza por .strict()', async () => {
    const respuesta = await request(crearAppDePrueba())
      .put('/recursos/7')
      .send({ nombre: 'Ana', idUsuario: 99 });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(error.codigo).toBe('VALIDACION_FALLIDA');
    expect(JSON.stringify(error.detalles)).toContain('idUsuario');
  });

  it('reporta todos los campos inválidos a la vez', async () => {
    const respuesta = await request(crearAppDePrueba())
      .put('/recursos/abc?pagina=0')
      .send({ nombre: '' });

    expect(camposConError(leerError(respuesta).detalles)).toEqual([
      'params.id',
      'query.pagina',
      'body.nombre',
    ]);
  });

  // Prueba de tipos: la verifica `pnpm typecheck`, no la ejecución.
  it('infiere los tipos de la entrada a partir de los esquemas (z.infer)', () => {
    manejar({ params: paramsSchema, body: cuerpoSchema }, (entrada) => {
      expectTypeOf(entrada.params).toEqualTypeOf<{ id: number }>();
      expectTypeOf(entrada.body).toEqualTypeOf<{ nombre: string }>();
      expectTypeOf(entrada.query).toEqualTypeOf<undefined>();
    });
  });
});
