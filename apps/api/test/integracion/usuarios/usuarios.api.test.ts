import type { Express } from 'express';
import sql from 'mssql';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { crearListaRevocadosRedis } from '../../../src/shared/adapters/lista-revocados-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
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
  dependenciasDePrueba({ listaRevocados: crearListaRevocadosRedis(redis, logger) }),
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

  it('activar devuelve el acceso al usuario', async () => {
    const correo = correoUnico();
    const { idUsuario } = leerSesion(await registrar(app, correo)).usuario;
    const token = await tokenDeAdmin();
    await request(app)
      .post(`/api/v1/usuarios/${String(idUsuario)}/desactivar`)
      .set(conToken(token));

    const respuesta = await request(app)
      .post(`/api/v1/usuarios/${String(idUsuario)}/activar`)
      .set(conToken(token));

    expect(respuesta.status).toBe(200);
    expect((await iniciarSesion(app, correo)).status).toBe(200);
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
