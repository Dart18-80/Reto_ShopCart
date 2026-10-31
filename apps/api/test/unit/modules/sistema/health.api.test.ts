import { Writable } from 'node:stream';
import type { Logger } from 'pino';
import { pino } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../../src/app.js';
import type { VerificadorRedis } from '../../../../src/modules/sistema/index.js';
import type { ConexionSP } from '../../../../src/shared/db/index.js';
import { configurarBaseDatos } from '../../../../src/shared/db/index.js';
import { crearLogger } from '../../../../src/shared/observability/logger.js';
import { leerDatos } from '../../respuestas.js';
import { dependenciasDePrueba } from '../../../app-de-prueba.js';

const loggerSilencioso = pino({ level: 'silent' });
const FILA_HEALTH = {
  VersionServidor: '16.0.4305.5',
  FechaHoraUtc: new Date('2026-10-29T23:00:00Z'),
};
const REDIS_DISPONIBLE: VerificadorRedis = { ping: () => Promise.resolve(true) };
const REDIS_DETENIDO: VerificadorRedis = { ping: () => Promise.resolve(false) };

const saludSchema = z
  .object({
    estado: z.enum(['ok', 'degradado', 'caido']),
    instancia: z.string(),
    baseDatos: z.enum(['ok', 'caida']),
    redis: z.enum(['ok', 'degradado']),
  })
  .strict();

let ejecutar: ReturnType<typeof vi.fn<ConexionSP['ejecutar']>>;

function crearAppDePrueba(verificadorRedis: VerificadorRedis, logger: Logger = loggerSilencioso) {
  return crearApp(dependenciasDePrueba({ logger, verificadorRedis }));
}

beforeEach(() => {
  ejecutar = vi.fn<ConexionSP['ejecutar']>(() => Promise.resolve([[FILA_HEALTH]]));
  configurarBaseDatos({ ejecutar }, loggerSilencioso);
});

describe('GET /api/v1/health', () => {
  it('responde 200 con el estado de la réplica, de la base y de Redis', async () => {
    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, saludSchema)).toEqual({
      estado: 'ok',
      instancia: 'api-prueba',
      baseDatos: 'ok',
      redis: 'ok',
    });
  });

  it('es pública: no expone la versión ni la hora de SQL Server', async () => {
    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    expect(respuesta.text).not.toContain('16.0.4305.5');
    expect(respuesta.text).not.toContain('2026-10-29');
  });

  it('registra en el log (debug) la versión y la hora de SQL Server', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const logger = crearLogger({ nivel: 'debug', destino });

    await request(crearAppDePrueba(REDIS_DISPONIBLE, logger)).get('/api/v1/health');

    const registro = lineas.find((linea) => linea.includes('versionServidor'));
    expect(registro).toContain('16.0.4305.5');
    expect(registro).toContain('2026-10-29T23:00:00.000Z');
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

  it('con la base y Redis caídos responde 503 y reporta ambos', async () => {
    ejecutar.mockRejectedValue(new Error('Failed to connect'));

    const respuesta = await request(crearAppDePrueba(REDIS_DETENIDO)).get('/api/v1/health');

    expect(respuesta.status).toBe(503);
    expect(leerDatos(respuesta, saludSchema)).toMatchObject({
      estado: 'caido',
      baseDatos: 'caida',
      redis: 'degradado',
    });
  });

  it('si SP_Sistema_Health no devuelve filas, la base cuenta como caída', async () => {
    ejecutar.mockResolvedValue([[]]);

    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    expect(respuesta.status).toBe(503);
    expect(leerDatos(respuesta, saludSchema).baseDatos).toBe('caida');
  });

  it('con la base caída responde 503 para que el balanceador saque la réplica', async () => {
    ejecutar.mockRejectedValue(new Error('Failed to connect'));

    const respuesta = await request(crearAppDePrueba(REDIS_DISPONIBLE)).get('/api/v1/health');

    const datos = leerDatos(respuesta, saludSchema);
    expect(respuesta.status).toBe(503);
    expect(datos.baseDatos).toBe('caida');
    expect(datos.estado).toBe('caido');
  });
});
