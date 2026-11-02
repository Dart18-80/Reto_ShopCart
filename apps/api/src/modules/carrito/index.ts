import type { RequestHandler, Router } from 'express';
import type { LimitadorIntentos } from '../../shared/http/index.js';
import { crearCarritoController } from './carrito.controller.js';
import { carritoRepository } from './carrito.repository.js';
import { crearCarritoRouter } from './carrito.routes.js';
import { crearCarritoService } from './carrito.service.js';

interface DependenciasCarrito {
  autenticar: RequestHandler;
  limitadorCreacion: LimitadorIntentos;
}

/** Monta /carrito (Cliente o invitado). */
export function crearModuloCarrito({ autenticar, limitadorCreacion }: DependenciasCarrito): Router {
  const servicio = crearCarritoService({ repositorio: carritoRepository, limitadorCreacion });
  return crearCarritoRouter(crearCarritoController(servicio), autenticar);
}

export { avisoFusionSchema, COOKIE_CARRITO, cookiesCarritoSchema } from './carrito.schemas.js';
export { borrarCookieCarrito } from './carrito.controller.js';
export { asignarCarritoDeInvitado, fusionarCarritoDeInvitado } from './carrito.sesion.js';
export type { AvisoFusion } from './carrito.types.js';
