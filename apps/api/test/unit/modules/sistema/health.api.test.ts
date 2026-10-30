import { pino } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../../src/app.js';
import type { ConexionSP } from '../../../../src/shared/db/index.js';
import { configurarBaseDatos } from '../../../../src/shared/db/index.js';
import { leerDatos } from '../../utilidades.js';

const logger = pino({ level: 'silent' });
const FILA_HEALTH = {
  VersionServidor: '16.0.4305.5',
  FechaHoraUtc: new Date('2026-10-29T23:00:00Z'),
};

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

function crearAppDePrueba({ redisResponde = true } = {}) {
  return crearApp({
    logger,
    instancia: 'api-prueba',
    origenesCors: ['http://localhost:5173'],
    verificadorRedis: { ping: () => Promise.resolve(redisResponde) },
  });
}

beforeEach(() => {
  ejecutar = vi.fn<ConexionSP['ejecutar']>(() => Promise.resolve([[FILA_HEALTH]]));
  configurarBaseDatos({ ejecutar }, logger);
});

describe('GET /api/v1/health', () => {
  it('responde 200 con el estado de la base y de Redis', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/api/v1/health');

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
    expect(ejecutar.mock.calls[0]?.[0]).toBe('SP_Sistema_Health');
  });

  it('con Redis detenido responde 200 con redis: "degradado"', async () => {
    const respuesta = await request(crearAppDePrueba({ redisResponde: false })).get(
      '/api/v1/health',
    );

    const datos = leerDatos(respuesta, saludSchema);
    expect(respuesta.status).toBe(200);
    expect(datos.redis).toBe('degradado');
    expect(datos.estado).toBe('degradado');
  });

  it('con la base caída responde 503 para que el balanceador saque la réplica', async () => {
    ejecutar.mockRejectedValue(new Error('Failed to connect'));

    const respuesta = await request(crearAppDePrueba()).get('/api/v1/health');

    const datos = leerDatos(respuesta, saludSchema);
    expect(respuesta.status).toBe(503);
    expect(datos.baseDatos).toEqual({ estado: 'caida' });
    expect(datos.estado).toBe('caido');
  });

  it('cada respuesta lleva X-Instancia, X-Request-Id y las cabeceras de helmet', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/api/v1/health');

    expect(respuesta.get('X-Instancia')).toBe('api-prueba');
    expect(respuesta.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(respuesta.get('X-Content-Type-Options')).toBe('nosniff');
    expect(respuesta.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(respuesta.get('Content-Security-Policy')).not.toContain('upgrade-insecure-requests');
    expect(respuesta.get('X-Powered-By')).toBeUndefined();
  });
});

describe('CORS', () => {
  it('permite solo los orígenes de CORS_ORIGINS, con credenciales', async () => {
    const app = crearAppDePrueba();

    const permitido = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    const ajeno = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://malicioso.example');

    expect(permitido.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(permitido.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(ajeno.get('Access-Control-Allow-Origin')).toBeUndefined();
  });
});

describe('OpenAPI', () => {
  it('publica el documento con el endpoint de salud', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/api/docs/openapi.json');

    const documento = z
      .object({ openapi: z.string(), paths: z.record(z.string(), z.unknown()) })
      .parse(respuesta.body);
    expect(respuesta.status).toBe(200);
    expect(documento.openapi).toMatch(/^3\.1/);
    expect(Object.keys(documento.paths)).toContain('/api/v1/health');
  });

  it('sirve la interfaz de Swagger en /api/docs', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/api/docs/');

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('swagger-ui');
  });
});
