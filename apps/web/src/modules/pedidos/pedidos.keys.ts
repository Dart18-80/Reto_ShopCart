import type { ConsultaMisPedidos } from './pedidos.api';

export const pedidosKeys = {
  todo: ['pedidos'] as const,
  listas: () => [...pedidosKeys.todo, 'lista'] as const,
  lista: (consulta: ConsultaMisPedidos) => [...pedidosKeys.listas(), consulta] as const,
  detalle: (idPedido: number) => [...pedidosKeys.todo, 'detalle', idPedido] as const,
};
