import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { manejadorErrores } from '../../../../src/shared/errors/middleware.js';
import { obtenerContexto } from '../../../../src/shared/http/contexto.js';
import { requestId } from '../../../../src/shared/http/request-id.js';

function crearAppDePrueba() {
  const app = express();
  app.use(requestId);
  app.get('/contexto', (_req, res) => {
    res.json({ requestId: obtenerContexto()?.requestId });
  });
  app.use(manejadorErrores(pino({ level: 'silent' })));
  return app;
}

describe('middleware requestId', () => {
  it('respeta un X-Request-Id válido que llega del cliente o de nginx', async () => {
    const id = '0b3d2a4e-1111-4222-8333-444455556666';

    const respuesta = await request(crearAppDePrueba()).get('/contexto').set('X-Request-Id', id);

    expect(respuesta.get('X-Request-Id')).toBe(id);
  });

  it('ignora un X-Request-Id que no es UUID y genera uno nuevo', async () => {
    const respuesta = await request(crearAppDePrueba())
      .get('/contexto')
      .set('X-Request-Id', '<script>');

    expect(respuesta.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('deja el mismo requestId en el contexto de la petición', async () => {
    const respuesta = await request(crearAppDePrueba()).get('/contexto');

    expect(respuesta.text).toContain(respuesta.get('X-Request-Id') ?? 'sin header');
  });
});
