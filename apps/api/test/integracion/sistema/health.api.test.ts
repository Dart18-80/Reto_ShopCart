import type sql from 'mssql';
import { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';

const saludSchema = z.object({
  estado: z.literal('ok'),
  baseDatos: z.object({
    estado: z.literal('ok'),
    versionServidor: z.string().regex(/^\d+\.\d+/),
    fechaHoraUtc: z.iso.datetime(),
  }),
  redis: z.literal('ok'),
});

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

describe('GET /api/v1/health contra SQL Server', () => {
  it('responde 200 con la versión y la hora reales del servidor (SP_Sistema_Health)', async () => {
    const app = crearApp({
      logger: pino({ level: 'silent' }),
      instancia: 'api-integracion',
      origenesCors: ['http://localhost:5173'],
      verificadorRedis: { ping: () => Promise.resolve(true) },
    });

    const respuesta = await request(app).get('/api/v1/health');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, saludSchema).baseDatos.estado).toBe('ok');
  });
});
