import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { LimitadorIntentos } from '../../shared/http/index.js';
import { crearCarritoController } from './carrito.controller.js';
import { carritoRepository } from './carrito.repository.js';
import { crearCarritoRouter } from './carrito.routes.js';
import { crearCarritoService } from './carrito.service.js';
import { crearCarritoDeInvitado, type CarritoDeInvitado } from './carrito.sesion.js';

interface DependenciasCarrito {
  autenticar: RequestHandler;
  limitadorCreacion: LimitadorIntentos;
  /** Secure en la cookie del carrito de invitado (fuera de desarrollo). */
  cookiesSeguras: boolean;
}

/** Monta /carrito (Cliente o invitado). */
export function crearModuloCarrito({
  autenticar,
  limitadorCreacion,
  cookiesSeguras,
}: DependenciasCarrito): Router {
  const servicio = crearCarritoService({ repositorio: carritoRepository, limitadorCreacion });
  return crearCarritoRouter(crearCarritoController(servicio, cookiesSeguras), autenticar);
}

export { COOKIE_CARRITO, cookiesCarritoSchema } from './carrito.schemas.js';
export { RUTA_COOKIE_CARRITO } from './carrito.controller.js';
export type { AvisoFusion } from './carrito.types.js';

/** N-05: lo que hace el inicio de sesión y el registro con el carrito de la cookie (app.ts lo inyecta en auth). */
export function crearCarritoDeInvitadoParaSesion(logger: Logger): CarritoDeInvitado {
  return crearCarritoDeInvitado({ repositorio: carritoRepository, logger });
}
