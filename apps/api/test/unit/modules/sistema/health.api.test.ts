import { pino } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../../src/app.js';
import type { VerificadorRedis } from '../../../../src/modules/sistema/index.js';
import type { ConexionSP } from '../../../../src/shared/db/index.js';
import { configurarBaseDatos } from '../../../../src/shared/db/index.js';
import { leerDatos } from '../../respuestas.js';

const logger = pino({ level: 'silent' });
const FILA_HEALTH = {
  VersionServidor: '16.0.4305.5',
  FechaHoraUtc: new Date('2026-10-29T23:00:00Z'),
};
const REDIS_DISPONIBLE: VerificadorRedis = { ping: () => Promise.resolve(true) };
const REDIS_DETENIDO: VerificadorRedis = { ping: () => Promise.resolve(false) };

const saludSchema = z.object({
  estado: z.enum(['ok', 'degradado', 'caido']),
  instancia: z.string(),
  baseDatos: z.object({
    estado: z.enum(['ok', 'caida']),
    versionServidor: z.string().optional(),
    fechaHoraUtc: z.string().optional(),
  }),
  redis: z.enum(['ok', 'degradado']),
});

let ejecutar: ReturnType<typeof vi.fn<ConexionSP['ejecutar']>>;

function crearAppDePrueba(verificadorRedis: VerificadorRedis) {
  return crearApp({
    logger,
    instancia: 'api-prueba',
    origenesCors: ['http://localhost:5173'],
    verificadorRedis,
  });
}

beforeEach(() => {
  ejecutar = vi.fn<ConexionSP['ejecutar']>(() => Promise.resolve([[FILA_HEALTH]]));
  configurarBaseDatos({ ejecutar }, logger);
});

describe('GET /api/v1/health', () => {
  it('responde 200 con el estado de la base y de Redis', async () => {
    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, saludSchema)).toEqual({
      estado: 'ok',
      instancia: 'api-prueba',
      baseDatos: {
        estado: 'ok',
        versionServidor: '16.0.4305.5',
        fechaHoraUtc: '2026-10-29T23:00:00.000Z',
      },
      redis: 'ok',
    });
  });

  it('consulta la base con SP_Sistema_Health', async () => {
    await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    expect(ejecutar.mock.calls[0]?.[0]).toBe('SP_Sistema_Health');
  });

  it('con Redis detenido responde 200 con redis: "degradado"', async () => {
    const respuesta = await request(crearAppDePrueba(REDIS_DETENIDO)).get('/api/v1/health');

    const datos = leerDatos(respuesta, saludSchema);
    expect(respuesta.status).toBe(200);
    expect(datos.redis).toBe('degradado');
    expect(datos.estado).toBe('degradado');
  });

  it('con la base caída responde 503 para que el balanceador saque la réplica', async () => {
    ejecutar.mockRejectedValue(new Error('Failed to connect'));

    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    const datos = leerDatos(respuesta, saludSchema);
    expect(respuesta.status).toBe(503);
    expect(datos.baseDatos).toEqual({ estado: 'caida' });
    expect(datos.estado).toBe('caido');
  });
});
