import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';

const saludSchema = z.object({
  estado: z.literal('ok'),
  baseDatos: z.literal('ok'),
  redis: z.literal('ok'),
});

usarBaseDePruebas();

describe('GET /api/v1/health contra SQL Server', () => {
  it('responde 200 con la base en ok tras ejecutar el SP_Sistema_Health real', async () => {
    const app = crearApp({
      logger: pino({ level: 'silent' }),
      instancia: 'api-integracion',
      origenesCors: ['http://localhost:5173'],
      verificadorRedis: { ping: () => Promise.resolve(true) },
    });

    const respuesta = await request(app).get('/api/v1/health');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, saludSchema).baseDatos).toBe('ok');
  });
});
