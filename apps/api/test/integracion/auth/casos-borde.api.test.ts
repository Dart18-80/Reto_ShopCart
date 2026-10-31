import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { crearLimitadorRedis } from '../../../src/shared/adapters/limitador-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  cookieRefresh,
  correoUnico,
  iniciarSesion,
  leerRefreshTokens,
  leerSesion,
  registrar,
  valorRefresh,
} from './apoyo-auth.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());

const refrescarConCookie = (cookie: string) =>
  request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

async function sesionNueva() {
  const respuesta = await registrar(app);
  return { idUsuario: leerSesion(respuesta).usuario.idUsuario, token: valorRefresh(respuesta) };
}

describe('casos borde del refresh token (E2-H02, A-07)', () => {
  it('dos refresh simultáneos con el mismo token: uno rota, el otro es un reúso y la familia queda revocada', async () => {
    const { idUsuario, token } = await sesionNueva();
    const cookie = `refresh=${encodeURIComponent(token)}`;

    const respuestas = await Promise.all([refrescarConCookie(cookie), refrescarConCookie(cookie)]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 401]);
    const rechazada = respuestas.find((r) => r.status === 401);
    expect(rechazada && leerError(rechazada).codigo).toBe('REFRESH_REUTILIZADO');
    const tokens = await leerRefreshTokens(idUsuario);
    expect(tokens).toHaveLength(2);
    expect(tokens.every((t) => t.MotivoRevocacion !== null)).toBe(true);
  });

  it.each([
    ['con un % suelto', 'refresh=%E0%A4%A'],
    ['vacía', 'refresh='],
    ['sin signo igual', 'refresh'],
    ['de 100 caracteres desconocidos', `refresh=${'a'.repeat(100)}`],
  ])('una cookie %s responde 401 NO_AUTENTICADO', async (_caso, cookie) => {
    const respuesta = await refrescarConCookie(cookie);

    expect(respuesta.status).toBe(401);
    expect(leerError(respuesta).codigo).toBe('NO_AUTENTICADO');
  });

  it('una cookie de más de 100 caracteres cuenta como ausente: 401 NO_AUTENTICADO', async () => {
    const respuesta = await refrescarConCookie(`refresh=${'a'.repeat(5000)}`);

    expect(respuesta.status).toBe(401);
    expect(leerError(respuesta).codigo).toBe('NO_AUTENTICADO');
  });

  it('con la cookie repetida usa la primera (la de ruta más específica)', async () => {
    const { token } = await sesionNueva();

    const respuesta = await refrescarConCookie(
      `otra=1; refresh=${encodeURIComponent(token)}; refresh=basura`,
    );

    expect(respuesta.status).toBe(200);
  });

  it('una cookie llamada __proto__ no rompe la lectura de cookies', async () => {
    const { token } = await sesionNueva();

    const respuesta = await refrescarConCookie(
      `__proto__=x; constructor=y; refresh=${encodeURIComponent(token)}`,
    );

    expect(respuesta.status).toBe(200);
  });

  it('el logout con una cookie basura responde 204 y borra la cookie', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh=${'a'.repeat(5000)}`);

    expect(respuesta.status).toBe(204);
    expect(cookieRefresh(respuesta)).toMatch(/^refresh=;/);
  });
});

describe('casos borde del rate limiting del login (E2-H01, A-07)', () => {
  const redis = crearClienteRedis(cargarConfiguracion(process.env).redis);
  const appConLimites = crearApp(
    dependenciasDePrueba({
      limitadores: {
        login: crearLimitadorRedis(redis, {
          prefijo: `prueba:${randomUUID()}:login`,
          intentos: 5,
          ventanaSeg: 60,
        }),
        registro: crearLimitadorRedis(redis, {
          prefijo: `prueba:${randomUUID()}:registro`,
          intentos: 3,
          ventanaSeg: 60,
        }),
      },
    }),
  );

  beforeAll(async () => {
    redis.on('error', () => undefined);
    await redis.connect();
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('variar mayúsculas y espacios del correo no da intentos extra', async () => {
    const correo = correoUnico();
    const variantes = [correo, correo.toUpperCase(), ` ${correo}`, `${correo} `, correo, correo];

    const estados: number[] = [];
    for (const variante of variantes) {
      estados.push((await iniciarSesion(appConLimites, variante, 'Incorrecta2026')).status);
    }

    expect(estados).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('el límite es por correo: agotar uno no bloquea a otro desde la misma IP', async () => {
    const agotado = correoUnico();
    for (let i = 0; i < 6; i++) await iniciarSesion(appConLimites, agotado, 'Incorrecta2026');

    const otro = await iniciarSesion(appConLimites, correoUnico(), 'Incorrecta2026');

    expect(otro.status).toBe(401);
  });
});
