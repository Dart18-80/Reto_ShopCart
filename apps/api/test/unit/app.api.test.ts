import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../src/app.js';
import { registroOpenApi } from '../../src/shared/openapi/index.js';

// Las cabeceras se prueban sobre el documento OpenAPI: no necesita base de datos y pasa por los
// mismos middlewares que cualquier otra ruta.
const RUTA_SIN_DEPENDENCIAS = '/api/docs/openapi.json';
const ORIGEN_PERMITIDO = 'http://localhost:5173';

function crearAppDePrueba() {
  return crearApp({
    logger: pino({ level: 'silent' }),
    instancia: 'api-prueba',
    origenesCors: [ORIGEN_PERMITIDO],
    verificadorRedis: { ping: () => Promise.resolve(true) },
  });
}

describe('cabeceras de cada respuesta', () => {
  it('X-Instancia identifica la réplica que respondió', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('X-Instancia')).toBe('api-prueba');
  });

  it('X-Request-Id lleva un UUID generado para la petición', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('helmet impide que el navegador adivine el tipo de contenido', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('§10: la CSP prohíbe mostrar la API dentro de un iframe', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('la CSP no fuerza https, porque el entorno local es HTTP', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('Content-Security-Policy')).not.toContain('upgrade-insecure-requests');
  });

  it('no revela que el servidor es Express', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    expect(respuesta.get('X-Powered-By')).toBeUndefined();
  });
});

describe('CORS', () => {
  it('permite un origen de CORS_ORIGINS, con credenciales', async () => {
    const respuesta = await request(crearAppDePrueba())
      .get(RUTA_SIN_DEPENDENCIAS)
      .set('Origin', ORIGEN_PERMITIDO);

    expect(respuesta.get('Access-Control-Allow-Origin')).toBe(ORIGEN_PERMITIDO);
    expect(respuesta.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('no permite un origen que no está en CORS_ORIGINS', async () => {
    const respuesta = await request(crearAppDePrueba())
      .get(RUTA_SIN_DEPENDENCIAS)
      .set('Origin', 'https://malicioso.example');

    expect(respuesta.get('Access-Control-Allow-Origin')).toBeUndefined();
  });
});

describe('OpenAPI', () => {
  it('publica el documento 3.1 con el endpoint de salud', async () => {
    const respuesta = await request(crearAppDePrueba()).get(RUTA_SIN_DEPENDENCIAS);

    const documento = z
      .object({ openapi: z.string(), paths: z.record(z.string(), z.unknown()) })
      .parse(respuesta.body);
    expect(respuesta.status).toBe(200);
    expect(documento.openapi).toMatch(/^3\.1/);
    expect(Object.keys(documento.paths)).toContain('/api/v1/health');
  });

  it('registra cada endpoint una sola vez aunque se creen varias apps', () => {
    crearAppDePrueba();
    crearAppDePrueba();

    const registrosDelHealth = registroOpenApi.definitions.filter(
      (definicion) => definicion.type === 'route' && definicion.route.path === '/api/v1/health',
    );
    expect(registrosDelHealth).toHaveLength(1);
  });

  it('sirve la interfaz de Swagger en /api/docs', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/api/docs/');

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain('swagger-ui');
  });
});
