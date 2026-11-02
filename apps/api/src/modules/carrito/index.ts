import type { RequestHandler, Router } from 'express';
import type { LimitadorIntentos } from '../../shared/http/index.js';
import { crearCarritoController } from './carrito.controller.js';
import { carritoRepository } from './carrito.repository.js';
import { crearCarritoRouter } from './carrito.routes.js';
import { crearCarritoService } from './carrito.service.js';

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
