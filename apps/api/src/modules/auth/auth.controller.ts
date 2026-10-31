import type { RequestHandler, Response } from 'express';
import { manejar } from '../../shared/http/index.js';
import { DIAS_VIGENCIA_REFRESH } from './auth.refresh.js';
import { loginSchema, registroSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { Sesion } from './auth.types.js';

const HTTP_CREADO = 201;
const HTTP_OK = 200;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const COOKIE_REFRESH = 'refresh';
// A-07: la cookie solo viaja a los endpoints de sesión, nunca al resto de la API.
export const RUTA_COOKIE_REFRESH = '/api/v1/auth';

/** A-07: el refresh token va solo en una cookie httpOnly; el cuerpo lleva el access token. */
export function enviarSesion(res: Response, sesion: Sesion, estado: number = HTTP_OK): void {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: RUTA_COOKIE_REFRESH,
    maxAge: DIAS_VIGENCIA_REFRESH * MS_POR_DIA,
  });
  res.status(estado).json({
    datos: { accessToken: sesion.accessToken, expiraEn: sesion.expiraEn, usuario: sesion.usuario },
  });
}

export interface AuthController {
  registro: RequestHandler;
  login: RequestHandler;
}

export function crearAuthController(servicio: AuthService): AuthController {
  return {
    registro: manejar({ body: registroSchema }, async ({ body, cliente }, res) => {
      enviarSesion(res, await servicio.registrar(body, cliente), HTTP_CREADO);
    }),

    login: manejar({ body: loginSchema }, async ({ body, cliente }, res) => {
      enviarSesion(res, await servicio.iniciarSesion(body, cliente));
    }),
  };
}
