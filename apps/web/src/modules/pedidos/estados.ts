import { ESTADOS_PEDIDO, type EstadoPedido } from '@shopcart/shared';

/** El contrato manda el estado como texto: solo los códigos de EstadoPedido se tratan como tales. */
export const esEstadoPedido = (valor: string): valor is EstadoPedido =>
  (ESTADOS_PEDIDO as readonly string[]).includes(valor);
