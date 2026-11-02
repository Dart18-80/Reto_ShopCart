import type { RequestHandler, Response } from 'express';
import { manejar } from '../../shared/http/index.js';
import { COOKIE_CARRITO, cookiesCarritoSchema, RUTA_COOKIE_CARRITO } from '../carrito/index.js';
import type { CarritoAlAbrirSesion, CarritoAlAbrirSesionService } from './auth.carrito.js';
import { DIAS_VIGENCIA_REFRESH } from './auth.refresh.js';
import { cookiesRefreshSchema, loginSchema, registroSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { AvisoFusionCarrito, Sesion } from './auth.types.js';

const HTTP_CREADO = 201;
const HTTP_OK = 200;
const HTTP_SIN_CONTENIDO = 204;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const COOKIE_REFRESH = 'refresh';
// A-07: la cookie solo viaja a los endpoints de sesión, nunca al resto de la API.
export const RUTA_COOKIE_REFRESH = '/api/v1/auth';

/**
 * A-07: el refresh token va solo en una cookie httpOnly; el cuerpo lleva el access token. Al iniciar sesión
 * o registrarse, también los avisos de la fusión del carrito de invitado (N-05).
 */
export function enviarSesion(
  res: Response,
  sesion: Sesion,
  estado: number = HTTP_OK,
  avisosCarrito?: AvisoFusionCarrito[],
): void {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: RUTA_COOKIE_REFRESH,
    maxAge: DIAS_VIGENCIA_REFRESH * MS_POR_DIA,
  });
  res.status(estado).json({
    datos: {
      accessToken: sesion.accessToken,
      expiraEn: sesion.expiraEn,
      usuario: sesion.usuario,
      ...(avisosCarrito === undefined ? {} : { avisosCarrito }),
    },
  });
}

// N-05: el carrito de invitado ya es del cliente; la cookie deja de servir.
function borrarCookieCarrito(res: Response, carrito: CarritoAlAbrirSesion): void {
  if (carrito.cookieConsumida) res.clearCookie(COOKIE_CARRITO, { path: RUTA_COOKIE_CARRITO });
}

export interface AuthController {
  registro: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
}

export function crearAuthController(
  servicio: AuthService,
  carritoInvitado: CarritoAlAbrirSesionService,
): AuthController {
  return {
    registro: manejar(
      { body: registroSchema, cookies: cookiesCarritoSchema },
      async ({ body, cookies, cliente }, res) => {
        const sesion = await servicio.registrar(body, cliente);
        const carrito = await carritoInvitado.alRegistrarse(
          sesion.usuario,
          cookies[COOKIE_CARRITO],
        );
        borrarCookieCarrito(res, carrito);
        enviarSesion(res, sesion, HTTP_CREADO, carrito.avisos);
      },
    ),

    login: manejar(
      { body: loginSchema, cookies: cookiesCarritoSchema },
      async ({ body, cookies, cliente }, res) => {
        const sesion = await servicio.iniciarSesion(body, cliente);
        const carrito = await carritoInvitado.alIniciarSesion(
          sesion.usuario,
          cookies[COOKIE_CARRITO],
        );
        borrarCookieCarrito(res, carrito);
        enviarSesion(res, sesion, HTTP_OK, carrito.avisos);
      },
    ),

    refresh: manejar({ cookies: cookiesRefreshSchema }, async ({ cookies, cliente }, res) => {
      enviarSesion(res, await servicio.refrescar(cookies.refresh, cliente));
    }),

    logout: manejar({ cookies: cookiesRefreshSchema }, async ({ cookies }, res) => {
      await servicio.cerrarSesion(cookies.refresh);
      res.clearCookie(COOKIE_REFRESH, { path: RUTA_COOKIE_REFRESH });
      res.status(HTTP_SIN_CONTENIDO).end();
    }),
  };
}
