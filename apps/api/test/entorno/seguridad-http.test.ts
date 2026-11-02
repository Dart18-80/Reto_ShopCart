import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { compose, esperarSaludable, RAIZ } from './apoyo-entorno.js';

const URL_BASE = process.env.SHOPCART_URL ?? 'http://localhost:8080';
const ORIGEN_AJENO = 'https://malicioso.example';

// La misma fuente que usa docker compose: CORS_ORIGINS de .env.
const origenesPermitidos = (
  process.env.CORS_ORIGINS ??
  parseEnv(readFileSync(join(RAIZ, '.env'), 'utf8')).CORS_ORIGINS ??
  ''
)
  .split(',')
  .map((origen) => origen.trim())
  .filter((origen) => origen !== '');
const [origenPermitido = ''] = origenesPermitidos;

const pedir = (ruta: string, init: RequestInit = {}) => fetch(`${URL_BASE}${ruta}`, init);

// Lo que helmet agrega a cada respuesta de la API (01-arquitectura.md §10).
const ENCABEZADOS_HELMET = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'origin-agent-cluster': '?1',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-dns-prefetch-control': 'off',
  'x-download-options': 'noopen',
  'x-frame-options': 'SAMEORIGIN',
  'x-permitted-cross-domain-policies': 'none',
  'x-xss-protection': '0',
};

const error500Schema = z.strictObject({
  error: z.strictObject({
    codigo: z.literal('ERROR_INTERNO'),
    mensaje: z.string(),
    requestId: z.uuid(),
  }),
});

describe('seguridad HTTP a través de nginx (verificación de entrega)', () => {
  it.each(['/api/v1/health', '/api/v1/no-existe'])(
    '%s lleva los encabezados de helmet',
    async (ruta) => {
      const respuesta = await pedir(ruta);

      for (const [nombre, valor] of Object.entries(ENCABEZADOS_HELMET)) {
        expect(respuesta.headers.get(nombre), nombre).toBe(valor);
      }
      expect(respuesta.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(respuesta.headers.get('strict-transport-security')).toMatch(/^max-age=\d+/);
    },
  );

  it.each(['/api/v1/health', '/', '/api/v1/no-existe'])(
    '%s no revela la tecnología: sin X-Powered-By y nginx sin versión',
    async (ruta) => {
      const respuesta = await pedir(ruta);

      expect(respuesta.headers.get('x-powered-by')).toBeNull();
      expect(respuesta.headers.get('server')).toBe('nginx');
    },
  );

  it('una página de error del propio nginx (413) tampoco muestra la versión', async () => {
    const respuesta = await pedir('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'a'.repeat(2 * 1024 * 1024),
    });

    expect(respuesta.status).toBe(413);
    expect(respuesta.headers.get('server')).toBe('nginx');
    expect(await respuesta.text()).not.toMatch(/nginx\/\d/);
  });

  it('CORS responde con el origen permitido de la configuración y con credenciales, nunca con *', async () => {
    const simple = await pedir('/api/v1/health', { headers: { Origin: origenPermitido } });
    const previa = await pedir('/api/v1/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: origenPermitido,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(origenPermitido).not.toBe('');
    expect(origenesPermitidos).not.toContain('*');
    for (const respuesta of [simple, previa]) {
      expect(respuesta.headers.get('access-control-allow-origin')).toBe(origenPermitido);
      expect(respuesta.headers.get('access-control-allow-credentials')).toBe('true');
    }
    expect(previa.status).toBe(204);
  });

  it('CORS no autoriza un origen fuera de la lista', async () => {
    const simple = await pedir('/api/v1/health', { headers: { Origin: ORIGEN_AJENO } });
    const previa = await pedir('/api/v1/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: ORIGEN_AJENO, 'Access-Control-Request-Method': 'POST' },
    });

    expect(simple.headers.get('access-control-allow-origin')).toBeNull();
    expect(previa.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('con NODE_ENV=development, un 500 real no trae stack ni detalles internos', async () => {
    const { stdout } = await compose('exec', '-T', 'api-1', 'printenv', 'NODE_ENV');
    expect(stdout.trim()).toBe('development');

    // Con SQL Server en pausa, la consulta se cancela por timeout (DB_TIMEOUT_CONSULTA_MS) y la API responde 500.
    await compose('pause', 'sqlserver');
    let respuesta: Response;
    try {
      respuesta = await pedir('/api/v1/categorias');
    } finally {
      await compose('unpause', 'sqlserver');
      await esperarSaludable('sqlserver');
    }
    const texto = await respuesta.text();

    expect(respuesta.status).toBe(500);
    expect(error500Schema.safeParse(JSON.parse(texto)).success).toBe(true);
    expect(texto).not.toMatch(/stack|\bat \w|Timeout|ETIMEOUT|mssql|tedious|\.js:\d/i);
  });
});
