import { pedidosRepository } from './pedidos.repository.js';

export { pedidoARespuesta, pedidoSchema } from './pedidos.respuesta.js';
export type { Pedido } from './pedidos.types.js';

/** RF-06: lo que el checkout usa de pedidos (las rutas de pedidos llegan en E6). */
export const pedidosParaCheckout = {
  crearDeIntento: (idIntentoPago: number) => pedidosRepository.crearDeIntento(idIntentoPago),
  obtener: (idPedido: number) => pedidosRepository.obtener(idPedido),
};

export type PedidosParaCheckout = typeof pedidosParaCheckout;
