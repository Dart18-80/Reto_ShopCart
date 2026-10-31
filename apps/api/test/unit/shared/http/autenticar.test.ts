import express, { type Express } from 'express';
import { SignJWT } from 'jose';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { manejadorErrores } from '../../../../src/shared/errors/middleware.js';
import {
  autorizar,
  crearAutenticar,
  crearTokensAcceso,
  obtenerContexto,
  requestId,
  type ListaRevocados,
  type Rol,
} from '../../../../src/shared/http/index.js';
import { leerDatos, leerError } from '../../respuestas.js';
import { z } from 'zod';

const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres';
const tokens = crearTokensAcceso(SECRETO);

function listaRevocados(revocados: number[] = []): ListaRevocados {
  return {
    estaRevocado: (idUsuario) => Promise.resolve(revocados.includes(idUsuario)),
    revocar: () => Promise.resolve(),
  };
}

function crearAppDePrueba(revocados: number[] = [], roles: Rol[] = ['Cliente']): Express {
  const app = express();
  app.use(requestId);
  app.get(
    '/privado',
    crearAutenticar({ tokens, listaRevocados: listaRevocados(revocados) }),
    autorizar(...roles),
    (_req, res) => {
      res.json({ datos: obtenerContexto() });
    },
  );
  app.use(manejadorErrores(pino({ level: 'silent' })));
  return app;
}

function pedirCon(app: Express, token?: string) {
  const peticion = request(app).get('/privado');
  return token === undefined ? peticion : peticion.set('Authorization', `Bearer ${token}`);
}

/** Firma un token a mano para casos que tokens.emitir no produce (vencido, otro rol, otra firma). */
function firmar(carga: Record<string, unknown>, expiracion: string | number, secreto = SECRETO) {
  return new SignJWT(carga)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('7')
    .setJti('jti-de-prueba')
    .setExpirationTime(expiracion)
    .sign(new TextEncoder().encode(secreto));
}

describe('autenticar (E2-H03, A-07)', () => {
  it('con un token válido deja al usuario y su rol en el contexto de la petición', async () => {
    const token = await tokens.emitir({ idUsuario: 7, rol: 'Cliente' });

    const respuesta = await pedirCon(crearAppDePrueba(), token);

    expect(respuesta.status).toBe(200);
    expect(
      leerDatos(respuesta, z.looseObject({ idUsuario: z.number(), rol: z.string() })),
    ).toMatchObject({
      idUsuario: 7,
      rol: 'Cliente',
    });
  });

  it.each([
    ['sin header Authorization', undefined],
    ['con un token que no es JWT', 'no-es-un-jwt'],
  ])('%s responde 401 NO_AUTENTICADO', async (_caso, token) => {
    const respuesta = await pedirCon(crearAppDePrueba(), token);

    expect(respuesta.status).toBe(401);
    expect(leerError(respuesta).codigo).toBe('NO_AUTENTICADO');
  });

  it('un token vencido responde 401', async () => {
    const vencido = await firmar({ rol: 'Cliente' }, Math.floor(Date.now() / 1000) - 1);

    expect((await pedirCon(crearAppDePrueba(), vencido)).status).toBe(401);
  });

  it('un token firmado con otro secreto responde 401', async () => {
    const ajeno = await firmar(
      { rol: 'Cliente' },
      '15m',
      'otro-secreto-de-al-menos-32-caracteres!!',
    );

    expect((await pedirCon(crearAppDePrueba(), ajeno)).status).toBe(401);
  });

  it('A-18: un token con el rol Sistema responde 401: ningún token puede traerlo', async () => {
    const sistema = await firmar({ rol: 'Sistema' }, '15m');

    expect(
      (await pedirCon(crearAppDePrueba([], ['Cliente', 'Administrador']), sistema)).status,
    ).toBe(401);
  });

  it('N-15: un usuario en la lista de revocados queda fuera aunque su token siga vigente', async () => {
    const token = await tokens.emitir({ idUsuario: 7, rol: 'Cliente' });

    const respuesta = await pedirCon(crearAppDePrueba([7]), token);

    expect(respuesta.status).toBe(401);
    expect(leerError(respuesta).codigo).toBe('NO_AUTENTICADO');
  });
});

describe('autorizar (E2-H03, RF-01)', () => {
  it('un token válido con un rol no permitido responde 403 SIN_PERMISO', async () => {
    const token = await tokens.emitir({ idUsuario: 7, rol: 'Cliente' });

    const respuesta = await pedirCon(crearAppDePrueba([], ['Administrador']), token);

    expect(respuesta.status).toBe(403);
    expect(leerError(respuesta).codigo).toBe('SIN_PERMISO');
  });

  it('acepta cualquiera de los roles indicados', async () => {
    const token = await tokens.emitir({ idUsuario: 3, rol: 'Operador' });

    const respuesta = await pedirCon(crearAppDePrueba([], ['Operador', 'Administrador']), token);

    expect(respuesta.status).toBe(200);
  });
});
