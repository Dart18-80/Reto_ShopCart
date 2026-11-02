import type { RequestHandler, Router } from 'express';
import { crearPedidosController } from './pedidos.controller.js';
import { pedidosRepository } from './pedidos.repository.js';
import { crearPedidosRouter } from './pedidos.routes.js';
import { crearPedidosService } from './pedidos.service.js';

export { pedidoARespuesta, pedidoSchema } from './pedidos.respuesta.js';
export type { Pedido } from './pedidos.types.js';

interface DependenciasPedidos {
  autenticar: RequestHandler;
}

/** Monta /pedidos (Cliente) y /admin/pedidos (Operador y Admin). */
export function crearModuloPedidos({ autenticar }: DependenciasPedidos): Router {
  const servicio = crearPedidosService({ repositorio: pedidosRepository });
  return crearPedidosRouter(crearPedidosController(servicio), autenticar);
}

/** RF-06: lo que el checkout usa de pedidos. */
export const pedidosParaCheckout = {
  crearDeIntento: (idIntentoPago: number, tokenArrendamiento: string) =>
    pedidosRepository.crearDeIntento(idIntentoPago, tokenArrendamiento),
  obtener: (idPedido: number) => pedidosRepository.obtener(idPedido),
  obtenerDeIntento: (idIntentoPago: number) => pedidosRepository.obtenerDeIntento(idIntentoPago),
};

export type PedidosParaCheckout = typeof pedidosParaCheckout;
