import type { RequestHandler, Router } from 'express';
import type { LimitadorIntentos } from '../../shared/http/index.js';
import type { Tarea } from '../../shared/jobs/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import { crearCarritoController } from './carrito.controller.js';
import { carritoRepository } from './carrito.repository.js';
import { crearCarritoRouter } from './carrito.routes.js';
import { crearCarritoService } from './carrito.service.js';
import { tareasCarrito } from './carrito.tareas.js';

interface DependenciasCarrito {
  autenticar: RequestHandler;
  limitadorCreacion: LimitadorIntentos;
  reportes: InvalidadorReportes;
}

/** Monta /carrito (Cliente o invitado). */
export function crearModuloCarrito({
  autenticar,
  limitadorCreacion,
  reportes,
}: DependenciasCarrito): Router {
  const servicio = crearCarritoService({
    repositorio: carritoRepository,
    limitadorCreacion,
    reportes,
  });
  return crearCarritoRouter(crearCarritoController(servicio), autenticar);
}

/** A-04: expiración de los carritos de invitado (E5-H04). */
export const crearTareasDeCarrito = (reportes: InvalidadorReportes): Tarea[] =>
  tareasCarrito(carritoRepository, reportes);

export { avisoFusionSchema, COOKIE_CARRITO, cookiesCarritoSchema } from './carrito.schemas.js';
export { borrarCookieCarrito } from './carrito.controller.js';
export { asignarCarritoDeInvitado, fusionarCarritoDeInvitado } from './carrito.sesion.js';
export type { AvisoFusion } from './carrito.types.js';
