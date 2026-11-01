import type { Express } from 'express';
import sql from 'mssql';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { crearVersionesSesionRedis } from '../../../src/shared/adapters/versiones-sesion-redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { crearLogger } from '../../../src/shared/observability/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { leerBitacora } from '../datos-de-prueba.js';
import {
  CONTRASENA,
  correoUnico,
  iniciarSesion,
  leerRefreshTokens,
  leerSesion,
  registrar,
  valorRefresh,
} from '../auth/apoyo-auth.js';

usarBaseDePruebas();

const redis = crearClienteRedis(cargarConfiguracion(process.env).redis);
const logger = crearLogger({ nivel: 'silent' });
const app: Express = crearApp(
  dependenciasDePrueba({ versionesSesion: crearVersionesSesionRedis(redis, logger) }),
);

beforeAll(async () => {
  redis.on('error', () => undefined);
  await redis.connect();
});

afterAll(() => {
  redis.disconnect();
});

const perfilSchema = z.looseObject({
  idUsuario: z.number(),
  correo: z.string(),
  nombre: z.string(),
  telefono: z.string().nullable(),
  rol: z.string(),
});

const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

interface Admin {
  idUsuario: number;
  token: string;
}

const PARES_DE_ADMINS = 3;
const ESPERA_ADMINS_CONCURRENTES_MS = 30_000;

async function sesionDeCliente() {
  const respuesta = await registrar(app);
  const sesion = leerSesion(respuesta);
  return { ...sesion.usuario, token: sesion.accessToken, refresh: valorRefresh(respuesta) };
}

async function tokenDeAdmin(): Promise<string> {
  return leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
}

async function crearAdmin(tokenAdmin: string) {
  const correo = correoUnico();
  const respuesta = await request(app)
    .post('/api/v1/usuarios')
    .set(conToken(tokenAdmin))
    .send({ correo, contrasena: CONTRASENA, nombre: 'Otro admin', rol: 'Administrador' });
  const { idUsuario } = leerDatos(respuesta, perfilSchema);
  return { idUsuario, token: leerSesion(await iniciarSesion(app, correo)).accessToken };
}

describe('perfil propio (E2-H04, RF-01)', () => {
  it.each([
    ['Operador', 'operador@shopcart.gt', 'Operador2026!'],
    ['Administrador', 'admin@shopcart.gt', 'Admin2026!'],
  ])('N-15: un %s también ve su perfil en /usuarios/me', async (rol, correo, contrasena) => {
    const { accessToken } = leerSesion(await iniciarSesion(app, correo, contrasena));

    const respuesta = await request(app).get('/api/v1/usuarios/me').set(conToken(accessToken));

    expect(leerDatos(respuesta, perfilSchema)).toMatchObject({ correo, rol });
  });

  it('GET /usuarios/me devuelve el perfil del dueño del token, sin el hash', async () => {
    const cliente = await sesionDeCliente();

    const respuesta = await request(app).get('/api/v1/usuarios/me').set(conToken(cliente.token));

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, perfilSchema)).toMatchObject({ idUsuario: cliente.idUsuario });
    expect(respuesta.text).not.toMatch(/hash|argon2/i);
  });

  it('RF-01: con dos clientes, cada uno ve y edita solo su perfil', async () => {
    const [ana, beto] = [await sesionDeCliente(), await sesionDeCliente()];

    await request(app)
      .patch('/api/v1/usuarios/me')
      .set(conToken(ana.token))
      .send({ nombre: 'Ana editada' });

    const deBeto = leerDatos(
      await request(app).get('/api/v1/usuarios/me').set(conToken(beto.token)),
      perfilSchema,
    );
    const deAna = leerDatos(
      await request(app).get('/api/v1/usuarios/me').set(conToken(ana.token)),
      perfilSchema,
    );
    expect(deAna).toMatchObject({ idUsuario: ana.idUsuario, nombre: 'Ana editada' });
    expect(deBeto).toMatchObject({ idUsuario: beto.idUsuario, nombre: 'Cliente de prueba' });
  });

  it('RF-01: el cliente no puede mandar su ID ni otros campos (400)', async () => {
    const cliente = await sesionDeCliente();

    const respuesta = await request(app)
      .patch('/api/v1/usuarios/me')
      .set(conToken(cliente.token))
      .send({ idUsuario: 1, nombre: 'Intruso' });

    expect(respuesta.status).toBe(400);
  });

  it('edita el teléfono y lo puede quitar con null', async () => {
    const cliente = await sesionDeCliente();
    const editar = (telefono: string | null) =>
      request(app).patch('/api/v1/usuarios/me').set(conToken(cliente.token)).send({ telefono });

    expect(leerDatos(await editar('55554444'), perfilSchema).telefono).toBe('55554444');
    expect(leerDatos(await editar(null), perfilSchema).telefono).toBeNull();
  });

  it('sin token responde 401', async () => {
    expect((await request(app).get('/api/v1/usuarios/me')).status).toBe(401);
  });
});

describe('POST /usuarios/me/contrasena (E2-H04, N-15)', () => {
  it('A-07: cambiar la contraseña conserva la sesión actual con tokens nuevos y corta las otras', async () => {
    const cliente = await sesionDeCliente();
    const otraSesion = leerSesion(await iniciarSesion(app, cliente.correo));

    const respuesta = await request(app)
      .post('/api/v1/usuarios/me/contrasena')
      .set(conToken(cliente.token))
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'NuevaClave2027' });

    const actual = leerSesion(respuesta);
    const perfil = (token: string) => request(app).get('/api/v1/usuarios/me').set(conToken(token));
    expect((await perfil(actual.accessToken)).status).toBe(200);
    const refrescoActual = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh=${encodeURIComponent(valorRefresh(respuesta))}`);
    expect(refrescoActual.status).toBe(200);
    expect((await perfil(otraSesion.accessToken)).status).toBe(401);
    expect((await perfil(cliente.token)).status).toBe(401);
  });

  it('con la contraseña actual correcta la cambia, revoca las otras sesiones y abre una nueva', async () => {
    const cliente = await sesionDeCliente();

    const respuesta = await request(app)
      .post('/api/v1/usuarios/me/contrasena')
      .set(conToken(cliente.token))
      .send({ contrasenaActual: CONTRASENA, contrasenaNueva: 'NuevaClave2027' });

    expect(respuesta.status).toBe(200);
    expect(valorRefresh(respuesta)).not.toBe(cliente.refresh);
    const viejo = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh=${encodeURIComponent(cliente.refresh)}`);
    expect(viejo.status).toBe(401);
    expect((await iniciarSesion(app, cliente.correo, 'NuevaClave2027')).status).toBe(200);
    expect((await iniciarSesion(app, cliente.correo, CONTRASENA)).status).toBe(401);
    const tokens = await leerRefreshTokens(cliente.idUsuario);
    expect(tokens.some((fila) => fila.MotivoRevocacion === 'CambioContrasena')).toBe(true);
  });

  it('con la contraseña actual incorrecta responde 400 y no cambia nada', async () => {
    const cliente = await sesionDeCliente();

    const respuesta = await request(app)
      .post('/api/v1/usuarios/me/contrasena')
      .set(conToken(cliente.token))
      .send({ contrasenaActual: 'NoEsLaMia2026', contrasenaNueva: 'NuevaClave2027' });

    expect(respuesta.status).toBe(400);
    expect((await iniciarSesion(app, cliente.correo, CONTRASENA)).status).toBe(200);
  });
});

describe('administración de usuarios (E2-H04, N-15)', () => {
  it('un Cliente o un Operador no puede listar usuarios (403)', async () => {
    const cliente = await sesionDeCliente();
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));

    for (const token of [cliente.token, operador.accessToken]) {
      expect((await request(app).get('/api/v1/usuarios').set(conToken(token))).status).toBe(403);
    }
  });

  it('RF-01: un Cliente o un Operador recibe 403 en cada ruta Admin que escribe y nada cambia', async () => {
    const objetivo = await sesionDeCliente();
    const cliente = await sesionDeCliente();
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const correoNuevo = correoUnico();
    const ruta = `/api/v1/usuarios/${String(objetivo.idUsuario)}`;
    const intentos = (token: string) => [
      request(app).post('/api/v1/usuarios').set(conToken(token)).send({
        correo: correoNuevo,
        contrasena: CONTRASENA,
        nombre: 'Intruso',
        rol: 'Administrador',
      }),
      request(app).patch(ruta).set(conToken(token)).send({ rol: 'Administrador' }),
      request(app).post(`${ruta}/desactivar`).set(conToken(token)),
      request(app).post(`${ruta}/activar`).set(conToken(token)),
    ];

    for (const token of [cliente.token, operador.accessToken]) {
      for (const respuesta of await Promise.all(intentos(token))) {
        expect(respuesta.status).toBe(403);
        expect(leerError(respuesta).codigo).toBe('SIN_PERMISO');
      }
    }

    const perfil = await request(app).get('/api/v1/usuarios/me').set(conToken(objetivo.token));
    expect(leerDatos(perfil, perfilSchema).rol).toBe('Cliente');
    expect((await iniciarSesion(app, correoNuevo)).status).toBe(401);
  });

  it('el Admin lista con paginación del servidor y filtra por rol y estado', async () => {
    const token = await tokenDeAdmin();

    const respuesta = await request(app)
      .get('/api/v1/usuarios?rol=Operador&activo=true&pagina=1&tamano=5')
      .set(conToken(token));

    const cuerpo = z
      .object({
        datos: z.array(perfilSchema),
        paginacion: z.object({ pagina: z.number(), tamano: z.number(), total: z.number() }),
      })
      .parse(respuesta.body);
    expect(cuerpo.datos.length).toBeGreaterThan(0);
    expect(cuerpo.datos.every((usuario) => usuario.rol === 'Operador')).toBe(true);
    expect(cuerpo.paginacion).toMatchObject({ pagina: 1, tamano: 5 });
  });

  it('el Admin crea un Operador; no puede crear un Cliente por esta vía', async () => {
    const token = await tokenDeAdmin();
    const crear = (rol: string) =>
      request(app)
        .post('/api/v1/usuarios')
        .set(conToken(token))
        .send({ correo: correoUnico(), contrasena: CONTRASENA, nombre: 'Nuevo', rol });

    const operador = await crear('Operador');
    const cliente = await crear('Cliente');

    expect(operador.status).toBe(201);
    expect(leerDatos(operador, perfilSchema).rol).toBe('Operador');
    expect(cliente.status).toBe(400);
  });

  it('un Admin no puede desactivarse a sí mismo (409 ACCION_SOBRE_SI_MISMO)', async () => {
    const admin = await crearAdmin(await tokenDeAdmin());

    const respuesta = await request(app)
      .post(`/api/v1/usuarios/${String(admin.idUsuario)}/desactivar`)
      .set(conToken(admin.token));

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('ACCION_SOBRE_SI_MISMO');
  });

  it.each(['Desactivar', 'QuitarRol'])(
    'nunca queda sin Admins activos: %s al último Admin responde ULTIMO_ADMIN',
    async (accion) => {
      const admin = await crearAdmin(await tokenDeAdmin());

      const intento = ejecutarSP('SP_Pruebas_ProbarUltimoAdmin', {
        IDAdmin: { tipo: sql.Int, valor: admin.idUsuario },
        Accion: { tipo: sql.VarChar(20), valor: accion },
      });

      await expect(intento).rejects.toMatchObject({ codigo: 'ULTIMO_ADMIN', status: 409 });
    },
  );

  // Antes cada SP bloqueaba la fila objetivo y después el rango de Admins activos: los pares cruzados
  // se bloqueaban mutuamente y agotaban los reintentos por deadlock (500). Crear los Admins cuesta
  // varios argon2, de ahí el tiempo límite.
  it.each(['desactivar', 'quitarRol'] as const)(
    'dos Admins a la vez: A desactiva a B mientras B hace "%s" sobre A, sin 500 por deadlock',
    { timeout: ESPERA_ADMINS_CONCURRENTES_MS },
    async (accionDeB) => {
      const tokenSemilla = await tokenDeAdmin();
      const pares = await Promise.all(
        Array.from({ length: PARES_DE_ADMINS }, async () => {
          const a = await crearAdmin(tokenSemilla);
          const b = await crearAdmin(tokenSemilla);
          return { a, b };
        }),
      );
      const acciones = {
        desactivar: (actor: Admin, objetivo: Admin) =>
          request(app)
            .post(`/api/v1/usuarios/${String(objetivo.idUsuario)}/desactivar`)
            .set(conToken(actor.token)),
        quitarRol: (actor: Admin, objetivo: Admin) =>
          request(app)
            .patch(`/api/v1/usuarios/${String(objetivo.idUsuario)}`)
            .set(conToken(actor.token))
            .send({ rol: 'Operador' }),
      };

      const respuestas = await Promise.all(
        pares.flatMap(({ a, b }) => [acciones.desactivar(a, b), acciones[accionDeB](b, a)]),
      );

      expect(respuestas.map((respuesta) => respuesta.status)).toEqual(
        Array(PARES_DE_ADMINS * 2).fill(200),
      );
    },
  );

  it('desactivar revoca los refresh tokens y el access token deja de servir de inmediato', async () => {
    const cliente = await sesionDeCliente();
    const token = await tokenDeAdmin();

    const respuesta = await request(app)
      .post(`/api/v1/usuarios/${String(cliente.idUsuario)}/desactivar`)
      .set(conToken(token));

    expect(respuesta.status).toBe(200);
    expect(
      (await request(app).get('/api/v1/usuarios/me').set(conToken(cliente.token))).status,
    ).toBe(401);
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh=${encodeURIComponent(cliente.refresh)}`);
    expect(refresh.status).toBe(401);
    expect((await leerRefreshTokens(cliente.idUsuario))[0]?.MotivoRevocacion).toBe('Desactivacion');
  });

  it('la bitácora registra la desactivación sin el hash de la contraseña', async () => {
    const cliente = await sesionDeCliente();
    const token = await tokenDeAdmin();

    await request(app)
      .post(`/api/v1/usuarios/${String(cliente.idUsuario)}/desactivar`)
      .set(conToken(token));

    const [fila] = await leerBitacora('Usuario', cliente.idUsuario);
    expect(fila).toMatchObject({ Accion: 'Desactivar' });
    expect(fila?.IDUsuario).not.toBeNull();
    expect(`${fila?.ValorAnterior ?? ''}${fila?.ValorNuevo ?? ''}`).not.toMatch(/hash|argon2/i);
  });

  it('A-07: activar devuelve el acceso con un login nuevo, pero no revive el token anterior', async () => {
    const correo = correoUnico();
    const anterior = leerSesion(await registrar(app, correo));
    const { idUsuario } = anterior.usuario;
    const token = await tokenDeAdmin();
    await request(app)
      .post(`/api/v1/usuarios/${String(idUsuario)}/desactivar`)
      .set(conToken(token));

    const respuesta = await request(app)
      .post(`/api/v1/usuarios/${String(idUsuario)}/activar`)
      .set(conToken(token));

    expect(respuesta.status).toBe(200);
    const sesion = leerSesion(await iniciarSesion(app, correo));
    const perfil = (token: string) => request(app).get('/api/v1/usuarios/me').set(conToken(token));
    expect((await perfil(sesion.accessToken)).status).toBe(200);
    expect((await perfil(anterior.accessToken)).status).toBe(401);
  });

  it('A-07: un Admin al que le quitan el rol pierde los permisos de inmediato con su token anterior', async () => {
    const tokenSemilla = await tokenDeAdmin();
    const degradado = await crearAdmin(tokenSemilla);
    const listar = () => request(app).get('/api/v1/usuarios').set(conToken(degradado.token));
    expect((await listar()).status).toBe(200);

    await request(app)
      .patch(`/api/v1/usuarios/${String(degradado.idUsuario)}`)
      .set(conToken(tokenSemilla))
      .send({ rol: 'Operador' });

    expect((await listar()).status).toBe(401);
  });

  it('A-07: dos réplicas ven la misma versión: lo que cambia en una corta el token en la otra', async () => {
    const redisReplica = crearClienteRedis(cargarConfiguracion(process.env).redis);
    redisReplica.on('error', () => undefined);
    await redisReplica.connect();
    const replica = crearApp(
      dependenciasDePrueba({ versionesSesion: crearVersionesSesionRedis(redisReplica, logger) }),
    );
    const cliente = await sesionDeCliente();
    const perfilEnReplica = () =>
      request(replica).get('/api/v1/usuarios/me').set(conToken(cliente.token));
    expect((await perfilEnReplica()).status).toBe(200);

    await request(app)
      .post(`/api/v1/usuarios/${String(cliente.idUsuario)}/desactivar`)
      .set(conToken(await tokenDeAdmin()));

    expect((await perfilEnReplica()).status).toBe(401);
    redisReplica.disconnect();
  });

  it('PATCH /usuarios/:id cambia el rol y un usuario inexistente responde 404', async () => {
    const cliente = await sesionDeCliente();
    const token = await tokenDeAdmin();

    const cambio = await request(app)
      .patch(`/api/v1/usuarios/${String(cliente.idUsuario)}`)
      .set(conToken(token))
      .send({ rol: 'Operador' });
    const inexistente = await request(app)
      .patch('/api/v1/usuarios/999999999')
      .set(conToken(token))
      .send({ nombre: 'Nadie' });

    expect(leerDatos(cambio, perfilSchema).rol).toBe('Operador');
    expect(inexistente.status).toBe(404);
  });
});
