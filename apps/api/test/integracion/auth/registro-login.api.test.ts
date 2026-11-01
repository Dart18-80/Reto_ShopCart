import { pino } from 'pino';
import { createHash, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import sql from 'mssql';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { crearLimitadorRedis } from '../../../src/shared/adapters/limitador-redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { crearLogger } from '../../../src/shared/observability/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  CONTRASENA,
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

describe('POST /auth/registro (E2-H01, N-15)', () => {
  it('crea un Cliente, abre la sesión y deja el refresh token solo en una cookie segura', async () => {
    const respuesta = await registrar(app);

    const sesion = leerSesion(respuesta);
    expect(respuesta.status).toBe(201);
    expect(sesion.usuario.rol).toBe('Cliente');
    expect(sesion.expiraEn).toBe(900);
    const cookie = cookieRefresh(respuesta) ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(JSON.stringify(respuesta.body)).not.toContain(valorRefresh(respuesta));
  });

  it('en la base solo queda el SHA-256 del refresh token', async () => {
    const respuesta = await registrar(app);

    const [guardado] = await leerRefreshTokens(leerSesion(respuesta).usuario.idUsuario);
    expect(guardado?.HashToken).toEqual(
      createHash('sha256').update(valorRefresh(respuesta)).digest(),
    );
  });

  it('un correo repetido con otras mayúsculas responde 409 CORREO_EN_USO', async () => {
    const correo = `Ana-${randomUUID()}@ShopCart.Test`;
    await registrar(app, correo);

    const respuesta = await registrar(app, correo.toLowerCase());

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('CORREO_EN_USO');
  });

  it.each([
    ['sin números', 'SoloLetras'],
    ['sin letras', '12345678'],
    ['con 7 caracteres', 'Clave12'],
  ])('rechaza una contraseña %s con 400', async (_caso, contrasena) => {
    const respuesta = await registrar(app, correoUnico(), contrasena);

    expect(respuesta.status).toBe(400);
  });

  it('N-15: no se puede registrar con otro rol (campo extra rechazado)', async () => {
    const respuesta = await request(app).post('/api/v1/auth/registro').send({
      correo: correoUnico(),
      contrasena: CONTRASENA,
      nombre: 'Intruso',
      rol: 'Administrador',
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('POST /auth/login (E2-H01, N-15)', () => {
  it.each([
    ['admin@shopcart.gt', 'Admin2026!', 'Administrador'],
    ['operador@shopcart.gt', 'Operador2026!', 'Operador'],
    ['cliente@shopcart.gt', 'Cliente2026!', 'Cliente'],
    ['CLIENTE2@shopcart.gt', 'Cliente2026!', 'Cliente'],
  ])('E1-H06: la cuenta demo %s inicia sesión con su rol', async (correo, contrasena, rol) => {
    const respuesta = await iniciarSesion(app, correo, contrasena);

    expect(respuesta.status).toBe(200);
    expect(leerSesion(respuesta).usuario.rol).toBe(rol);
    expect(cookieRefresh(respuesta)).toBeDefined();
  });

  it('credenciales incorrectas y usuario inexistente responden el mismo 401 genérico', async () => {
    const correo = correoUnico();
    await registrar(app, correo);

    const incorrecta = await iniciarSesion(app, correo, 'OtraClave2026');
    const inexistente = await iniciarSesion(app, correoUnico());

    expect(incorrecta.status).toBe(401);
    expect(inexistente.status).toBe(401);
    const sinRequestId = ({ requestId: _id, ...resto }: ReturnType<typeof leerError>) => resto;
    expect(sinRequestId(leerError(incorrecta))).toEqual(sinRequestId(leerError(inexistente)));
    expect(cookieRefresh(incorrecta)).toBeUndefined();
  });

  it('un usuario desactivado no puede iniciar sesión', async () => {
    const correo = correoUnico();
    const { idUsuario } = leerSesion(await registrar(app, correo)).usuario;
    await ejecutarSP('SP_Pruebas_CambiarUsuario', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      Cambio: { tipo: sql.VarChar(20), valor: 'Desactivar' },
    });

    const respuesta = await iniciarSesion(app, correo);

    expect(respuesta.status).toBe(401);
    expect(leerError(respuesta).codigo).toBe('USUARIO_INACTIVO');
    expect(cookieRefresh(respuesta)).toBeUndefined();
  });
});

describe('rate limiting con Redis (E2-H01, A-07)', () => {
  const redis = crearClienteRedis(cargarConfiguracion(process.env).redis);
  // Prefijos únicos: cada corrida empieza con los contadores en cero.
  const prefijo = `prueba:${randomUUID()}`;
  const appConLimites = crearApp(
    dependenciasDePrueba({
      limitadores: {
        ...dependenciasDePrueba().limitadores,
        login: crearLimitadorRedis(redis, pino({ level: 'silent' }), {
          prefijo: `${prefijo}:login`,
          intentos: 5,
          ventanaSeg: 60,
        }),
        registro: crearLimitadorRedis(redis, pino({ level: 'silent' }), {
          prefijo: `${prefijo}:registro`,
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

  it('el sexto intento de login en un minuto responde 429 con Retry-After', async () => {
    const correo = correoUnico();
    const estados: number[] = [];
    for (let intento = 0; intento < 6; intento++) {
      estados.push((await iniciarSesion(appConLimites, correo, 'Incorrecta2026')).status);
    }

    expect(estados).toEqual([401, 401, 401, 401, 401, 429]);
  });

  it('el cuarto registro en un minuto desde la misma IP responde 429', async () => {
    const estados: number[] = [];
    for (let intento = 0; intento < 4; intento++) {
      estados.push((await registrar(appConLimites)).status);
    }

    expect(estados).toEqual([201, 201, 201, 429]);
  });
});

describe('los logs nunca llevan contraseñas, tokens ni cookies', () => {
  it('registro, login y un error de credenciales no dejan secretos en el log', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const appConLog = crearApp(
      dependenciasDePrueba({ logger: crearLogger({ nivel: 'debug', destino }) }),
    );
    const correo = correoUnico();

    const registro = await registrar(appConLog, correo);
    const login = await iniciarSesion(appConLog, correo);
    await iniciarSesion(appConLog, correo, 'Incorrecta2026');

    const log = lineas.join('');
    expect(log).not.toBe('');
    for (const secreto of [
      CONTRASENA,
      'Incorrecta2026',
      leerSesion(registro).accessToken,
      leerSesion(login).accessToken,
      valorRefresh(registro),
      valorRefresh(login),
    ]) {
      expect(log).not.toContain(secreto);
    }
  });

  it('refresh, logout, perfil, cambio de contraseña y alta por Admin no dejan el Bearer, la cookie ni las contraseñas', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const appConLog = crearApp(
      dependenciasDePrueba({ logger: crearLogger({ nivel: 'debug', destino }) }),
    );
    const contrasenaNueva = 'NuevaClave2027';
    const contrasenaInterna = 'Interna2027x';
    const registro = await registrar(appConLog);
    const bearer = { Authorization: `Bearer ${leerSesion(registro).accessToken}` };
    const refresco = await request(appConLog)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh=${encodeURIComponent(valorRefresh(registro))}`);
    const tokenAdmin = leerSesion(
      await iniciarSesion(appConLog, 'admin@shopcart.gt', 'Admin2026!'),
    ).accessToken;

    await request(appConLog).get('/api/v1/usuarios/me').set(bearer);
    await request(appConLog)
      .post('/api/v1/usuarios/me/contrasena')
      .set(bearer)
      .send({ contrasenaActual: 'NoEsLaMia2026', contrasenaNueva });
    const cambio = await request(appConLog)
      .post('/api/v1/usuarios/me/contrasena')
      .set(bearer)
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva });
    await request(appConLog)
      .post('/api/v1/usuarios')
      .set({ Authorization: `Bearer ${tokenAdmin}` })
      .send({
        correo: correoUnico(),
        contrasena: contrasenaInterna,
        nombre: 'Op',
        rol: 'Operador',
      });
    await request(appConLog)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh=${encodeURIComponent(valorRefresh(cambio))}`);

    const log = lineas.join('');
    expect(log).not.toBe('');
    for (const secreto of [
      CONTRASENA,
      'NoEsLaMia2026',
      contrasenaNueva,
      contrasenaInterna,
      'Admin2026!',
      leerSesion(registro).accessToken,
      leerSesion(refresco).accessToken,
      leerSesion(cambio).accessToken,
      tokenAdmin,
      valorRefresh(registro),
      valorRefresh(refresco),
      valorRefresh(cambio),
    ]) {
      expect(log).not.toContain(secreto);
    }
  });
});
