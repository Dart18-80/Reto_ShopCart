import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { PasarelaPago } from '../../shared/pasarela/index.js';
import { pedidosParaCheckout } from '../pedidos/index.js';
import { crearCheckoutController } from './checkout.controller.js';
import { crearPagoService } from './checkout.pago.js';
import { checkoutRepository } from './checkout.repository.js';
import { crearCheckoutRouter } from './checkout.routes.js';
import { crearCheckoutService } from './checkout.service.js';

interface DependenciasCheckout {
  autenticar: RequestHandler;
  pasarela: PasarelaPago;
  logger: Logger;
}

/** Monta /checkout (Cliente). */
export function crearModuloCheckout({
  autenticar,
  pasarela,
  logger,
}: DependenciasCheckout): Router {
  const servicio = crearCheckoutService({ repositorio: checkoutRepository });
  const pago = crearPagoService({
    repositorio: checkoutRepository,
    pedidos: pedidosParaCheckout,
    pasarela,
    logger: logger.child({ modulo: 'checkout' }),
  });
  return crearCheckoutRouter(crearCheckoutController(servicio, pago), autenticar);
}
