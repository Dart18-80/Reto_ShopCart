import type { RequestHandler, Router } from 'express';
import type { Logger } from 'pino';
import type { Tarea } from '../../shared/jobs/index.js';
import type { PasarelaPago } from '../../shared/pasarela/index.js';
import { crearPedidosController } from './pedidos.controller.js';
import { pedidosRepository } from './pedidos.repository.js';
import { crearPedidosRouter } from './pedidos.routes.js';
import { crearReembolsosService } from './pedidos.reembolsos.js';
import { crearPedidosService } from './pedidos.service.js';
import { tareasPedidos } from './pedidos.tareas.js';

export { pedidoARespuesta, pedidoSchema } from './pedidos.respuesta.js';
export type { Pedido } from './pedidos.types.js';

interface DependenciasPedidos {
  autenticar: RequestHandler;
  pasarela: PasarelaPago;
  logger: Logger;
}

const crearReembolsos = ({ pasarela, logger }: Omit<DependenciasPedidos, 'autenticar'>) =>
  crearReembolsosService({
    repositorio: pedidosRepository,
    pasarela,
    logger: logger.child({ modulo: 'pedidos' }),
  });

/** Monta /pedidos (Cliente), /admin/pedidos (Operador y Admin) y /admin/reembolsos (Admin). */
export function crearModuloPedidos({ autenticar, ...dependencias }: DependenciasPedidos): Router {
  const servicio = crearPedidosService({ repositorio: pedidosRepository });
  return crearPedidosRouter(
    crearPedidosController(servicio, crearReembolsos(dependencias)),
    autenticar,
  );
}

/** A-04: reintento de los reembolsos pendientes (E6-H03). */
export const crearTareasDePedidos = (
  dependencias: Omit<DependenciasPedidos, 'autenticar'>,
): Tarea[] => tareasPedidos(crearReembolsos(dependencias));

/** RF-06: lo que el checkout usa de pedidos. */
export const pedidosParaCheckout = {
  crearDeIntento: (idIntentoPago: number, tokenArrendamiento: string) =>
    pedidosRepository.crearDeIntento(idIntentoPago, tokenArrendamiento),
  obtener: (idPedido: number) => pedidosRepository.obtener(idPedido),
  obtenerDeIntento: (idIntentoPago: number) => pedidosRepository.obtenerDeIntento(idIntentoPago),
};

export type PedidosParaCheckout = typeof pedidosParaCheckout;
