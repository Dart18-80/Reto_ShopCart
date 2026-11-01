import sql from 'mssql';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  cookieRefresh,
  iniciarSesion,
  leerRefreshTokens,
  leerSesion,
  registrar,
  valorRefresh,
} from './apoyo-auth.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());

function refrescar(token?: string) {
  const peticion = request(app).post('/api/v1/auth/refresh');
  return token === undefined
    ? peticion
    : peticion.set('Cookie', `refresh=${encodeURIComponent(token)}`);
}

function cerrarSesion(token: string) {
  return request(app)
    .post('/api/v1/auth/logout')
    .set('Cookie', `refresh=${encodeURIComponent(token)}`);
}

async function sesionNueva() {
  const respuesta = await registrar(app);
  return { idUsuario: leerSesion(respuesta).usuario.idUsuario, token: valorRefresh(respuesta) };
}

describe('POST /auth/refresh (E2-H02, A-07)', () => {
  it('emite un refresh nuevo y un access token; el anterior deja de servir', async () => {
    const { token } = await sesionNueva();

    const rotacion = await refrescar(token);
    const conElNuevo = await refrescar(valorRefresh(rotacion));
    const reintento = await refrescar(token);

    expect(rotacion.status).toBe(200);
    expect(leerSesion(rotacion).accessToken).toBeTruthy();
    expect(valorRefresh(rotacion)).not.toBe(token);
    expect(conElNuevo.status).toBe(200);
    expect(reintento.status).toBe(401);
  });

  it('el reúso solo revoca su familia: otra sesión del mismo usuario sigue rotando', async () => {
    const respuesta = await registrar(app);
    const { correo } = leerSesion(respuesta).usuario;
    const primeroA = valorRefresh(respuesta);
    const sesionB = valorRefresh(await iniciarSesion(app, correo));
    const segundoA = valorRefresh(await refrescar(primeroA));
    const terceroA = valorRefresh(await refrescar(segundoA));

    expect((await refrescar(primeroA)).status).toBe(401);

    expect((await refrescar(terceroA)).status).toBe(401);
    expect((await refrescar(sesionB)).status).toBe(200);
  });

  it('reusar un token ya rotado revoca toda la familia: el más reciente también deja de servir', async () => {
    const { idUsuario, token: primero } = await sesionNueva();
    const segundo = valorRefresh(await refrescar(primero));

    const reuso = await refrescar(primero);
    const conElMasReciente = await refrescar(segundo);

    expect(reuso.status).toBe(401);
    expect(leerError(reuso).codigo).toBe('REFRESH_REUTILIZADO');
    expect(conElMasReciente.status).toBe(401);
    const familia = await leerRefreshTokens(idUsuario);
    expect(familia.map((fila) => fila.MotivoRevocacion)).toEqual(['Reuso', 'Reuso']);
  });

  it('sin cookie o con un token desconocido responde 401 NO_AUTENTICADO', async () => {
    for (const respuesta of [await refrescar(), await refrescar('no-es-un-token')]) {
      expect(respuesta.status).toBe(401);
      expect(leerError(respuesta).codigo).toBe('NO_AUTENTICADO');
    }
  });

  it('un refresh vencido responde 401', async () => {
    const { idUsuario, token } = await sesionNueva();
    await ejecutarSP('SP_Pruebas_VencerRefreshTokens', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
    });

    expect((await refrescar(token)).status).toBe(401);
  });

  it('el refresh de un usuario desactivado responde 401', async () => {
    const { idUsuario, token } = await sesionNueva();
    await ejecutarSP('SP_Pruebas_CambiarUsuario', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      Cambio: { tipo: sql.VarChar(20), valor: 'Desactivar' },
    });

    expect((await refrescar(token)).status).toBe(401);
  });
});

describe('POST /auth/logout (E2-H02, A-07)', () => {
  it('responde 204, borra la cookie y después el refresh responde 401', async () => {
    const { idUsuario, token } = await sesionNueva();

    const salida = await cerrarSesion(token);
    const despues = await refrescar(token);

    expect(salida.status).toBe(204);
    expect(cookieRefresh(salida)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(despues.status).toBe(401);
    expect((await leerRefreshTokens(idUsuario))[0]?.MotivoRevocacion).toBe('Logout');
  });

  it('sin cookie también responde 204', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(204);
  });
});
