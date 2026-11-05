import type { ConsultaMisPedidos } from './pedidos.api';

export const pedidosKeys = {
  todo: ['pedidos'] as const,
  lista: (consulta: ConsultaMisPedidos) => [...pedidosKeys.todo, 'lista', consulta] as const,
  detalle: (idPedido: number) => [...pedidosKeys.todo, 'detalle', idPedido] as const,
};
