import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { manejadorErrores } from '../../../../src/shared/errors/middleware.js';
import { requestId } from '../../../../src/shared/http/request-id.js';
import { validar } from '../../../../src/shared/http/validar.js';
import { leerDatos, leerError } from '../../respuestas.js';

const cuerpoSchema = z.object({ nombre: z.string().min(1) }).strict();

function crearAppDePrueba() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post('/validado', validar({ body: cuerpoSchema }), (req, res) => {
    res.json({ datos: cuerpoSchema.parse(req.body) });
  });
  app.use(manejadorErrores(pino({ level: 'silent' })));
  return app;
}

describe('middleware validar', () => {
  it('una validación Zod fallida responde 400 VALIDACION_FALLIDA con el campo', async () => {
    const respuesta = await request(crearAppDePrueba())
      .post('/validado')
      .send({ nombre: '', idUsuario: 5 });

    const error = leerError(respuesta);
    expect(respuesta.status).toBe(400);
    expect(error.codigo).toBe('VALIDACION_FALLIDA');
    expect(JSON.stringify(error.detalles)).toContain('nombre');
  });

  it('un cuerpo válido llega al controlador ya validado', async () => {
    const respuesta = await request(crearAppDePrueba()).post('/validado').send({ nombre: 'Ana' });

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, z.object({ nombre: z.string() }))).toEqual({ nombre: 'Ana' });
  });
});
