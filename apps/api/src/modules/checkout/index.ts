import type { RequestHandler, Router } from 'express';
import { crearCheckoutController } from './checkout.controller.js';
import { checkoutRepository } from './checkout.repository.js';
import { crearCheckoutRouter } from './checkout.routes.js';
import { crearCheckoutService } from './checkout.service.js';

interface DependenciasCheckout {
  autenticar: RequestHandler;
}

/** Monta /checkout (Cliente). */
export function crearModuloCheckout({ autenticar }: DependenciasCheckout): Router {
  const servicio = crearCheckoutService({ repositorio: checkoutRepository });
  return crearCheckoutRouter(crearCheckoutController(servicio), autenticar);
}
