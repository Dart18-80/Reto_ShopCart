import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { Tarea } from '../../shared/jobs/index.js';
import type { PasarelaPago } from '../../shared/pasarela/index.js';
import type { Reloj } from '../../shared/reloj/index.js';
import { pedidosParaCheckout } from '../pedidos/index.js';
import { crearConciliacionService } from './checkout.conciliacion.js';
import { crearCheckoutController } from './checkout.controller.js';
import { crearPagoService } from './checkout.pago.js';
import { checkoutRepository } from './checkout.repository.js';
import { crearCheckoutRouter } from './checkout.routes.js';
import { crearCheckoutService } from './checkout.service.js';
import { tareasCheckout } from './checkout.tareas.js';

interface DependenciasCheckout {
  autenticar: RequestHandler;
  pasarela: PasarelaPago;
  logger: Logger;
  reloj: Reloj;
}

/** Monta /checkout (Cliente). */
export function crearModuloCheckout({
  autenticar,
  pasarela,
  logger,
  reloj,
}: DependenciasCheckout): Router {
  const servicio = crearCheckoutService({ repositorio: checkoutRepository });
  const pago = crearPagoService({
    repositorio: checkoutRepository,
    pedidos: pedidosParaCheckout,
    pasarela,
    logger: logger.child({ modulo: 'checkout' }),
  });
  return crearCheckoutRouter(crearCheckoutController(servicio, pago, reloj), autenticar);
}

/** A-04: expiración de sesiones y conciliación de pagos (E5-H04). */
export function crearTareasDeCheckout({
  pasarela,
  logger,
}: Pick<DependenciasCheckout, 'pasarela' | 'logger'>): Tarea[] {
  const conciliacion = crearConciliacionService({
    repositorio: checkoutRepository,
    pasarela,
    logger: logger.child({ modulo: 'checkout', tarea: 'conciliacion' }),
  });
  return tareasCheckout(checkoutRepository, conciliacion);
}
