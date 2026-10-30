import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../../../../src/shared/errors/app-error.js';
import { manejadorErrores, rutaNoEncontrada } from '../../../../src/shared/errors/middleware.js';
import { requestId } from '../../../../src/shared/http/request-id.js';
import { validar } from '../../../../src/shared/http/validar.js';
import { crearLogger } from '../../../../src/shared/observability/logger.js';
import { leerDatos, leerError } from '../../utilidades.js';

const lineaLogSchema = z.looseObject({ level: z.number(), requestId: z.string().optional() });

function loggerEnMemoria() {
  const lineas: z.infer<typeof lineaLogSchema>[] = [];
  const crudas: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      crudas.push(fragmento.toString());
      lineas.push(lineaLogSchema.parse(JSON.parse(fragmento.toString())));
      listo();
    },
  });
  return { logger: crearLogger({ destino }), lineas, crudas };
}

function crearAppDePrueba() {
  const { logger, lineas, crudas } = loggerEnMemoria();
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '1kb' }));
  app.get('/negocio', () => {
    throw new AppError('PARAMETRO_INVALIDO', 'La página no es válida.');
  });
  app.get('/detalles', () => {
    throw new AppError('STOCK_INSUFICIENTE', 'Sin existencia.', [{ idVariante: 7 }]);
  });
  app.get('/inesperado', () => {
    throw new Error('conexión perdida con 10.0.0.5: detalle interno');
  });
  const cuerpoSchema = z.object({ nombre: z.string().min(1) }).strict();
  app.post('/validado', validar({ body: cuerpoSchema }), (req, res) => {
    res.json({ datos: cuerpoSchema.parse(req.body) });
  });
  app.use(rutaNoEncontrada);
  app.use(manejadorErrores(logger));
  return { app, lineas, crudas };
}

describe('middleware central de errores', () => {
  it('responde un error de negocio con su HTTP, código, mensaje y requestId', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).get('/negocio');

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta)).toEqual({
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'La página no es válida.',
      requestId: respuesta.get('X-Request-Id'),
    });
  });

  it('incluye los detalles cuando el error los trae (A-19)', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).get('/detalles');

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).detalles).toEqual([{ idVariante: 7 }]);
  });

  it('un error inesperado responde 500 sin detalles internos y queda en el log con su requestId', async () => {
    const { app, lineas, crudas } = crearAppDePrueba();

    const respuesta = await request(app).get('/inesperado');

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(500);
    expect(error.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(error)).not.toContain('10.0.0.5');
    const indice = lineas.findIndex((linea) => linea.level === 50);
    expect(lineas[indice]?.requestId).toBe(error.requestId);
    expect(crudas[indice]).toContain('10.0.0.5');
  });

  it('respeta un X-Request-Id válido que llega del cliente o de nginx', async () => {
    const { app } = crearAppDePrueba();
    const id = '0b3d2a4e-1111-4222-8333-444455556666';

    const respuesta = await request(app).get('/negocio').set('X-Request-Id', id);

    expect(respuesta.get('X-Request-Id')).toBe(id);
    expect(leerError(respuesta).requestId).toBe(id);
  });

  it('ignora un X-Request-Id que no es UUID y genera uno nuevo', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).get('/negocio').set('X-Request-Id', '<script>');

    expect(respuesta.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('una validación Zod fallida responde 400 VALIDACION_FALLIDA con el campo', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).post('/validado').send({ nombre: '', idUsuario: 5 });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(error.codigo).toBe('VALIDACION_FALLIDA');
    expect(JSON.stringify(error.detalles)).toContain('nombre');
  });

  it('un cuerpo válido llega al controlador ya validado', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).post('/validado').send({ nombre: 'Ana' });

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, z.object({ nombre: z.string() }))).toEqual({ nombre: 'Ana' });
  });

  it('un JSON mal formado responde 400 JSON_INVALIDO', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app)
      .post('/validado')
      .set('Content-Type', 'application/json')
      .send('{"nombre":');

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('JSON_INVALIDO');
  });

  it('un cuerpo mayor al límite responde 413 CUERPO_DEMASIADO_GRANDE', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app)
      .post('/validado')
      .send({ nombre: 'x'.repeat(2000) });

    expect(respuesta.status).toBe(413);
    expect(leerError(respuesta).codigo).toBe('CUERPO_DEMASIADO_GRANDE');
  });

  it('una ruta inexistente responde 404 NO_ENCONTRADO', async () => {
    const { app } = crearAppDePrueba();

    const respuesta = await request(app).get('/no-existe');

    expect(respuesta.status).toBe(404);
    expect(leerError(respuesta).codigo).toBe('NO_ENCONTRADO');
  });
});
