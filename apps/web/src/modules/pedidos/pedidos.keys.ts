import type { ConsultaPedidosGestion, ConsultaReembolsos } from '@shopcart/shared';
import type { ConsultaMisPedidos } from './pedidos.api';

export const pedidosKeys = {
  todo: ['pedidos'] as const,
  listas: () => [...pedidosKeys.todo, 'lista'] as const,
  lista: (consulta: ConsultaMisPedidos) => [...pedidosKeys.listas(), consulta] as const,
  detalle: (idPedido: number) => [...pedidosKeys.todo, 'detalle', idPedido] as const,
  // M8: la gestión tiene sus propias llaves; su detalle trae más campos que el del Cliente.
  gestion: () => [...pedidosKeys.todo, 'gestion'] as const,
  listasGestion: () => [...pedidosKeys.gestion(), 'lista'] as const,
  listaGestion: (consulta: ConsultaPedidosGestion) =>
    [...pedidosKeys.listasGestion(), consulta] as const,
  detalleGestion: (idPedido: number) => [...pedidosKeys.gestion(), 'detalle', idPedido] as const,
  // M8-H05: la revisión manual del Administrador.
  reembolsos: () => [...pedidosKeys.todo, 'reembolsos'] as const,
  listaReembolsos: (consulta: ConsultaReembolsos) =>
    [...pedidosKeys.reembolsos(), consulta] as const,
  pagosEnRevision: () => [...pedidosKeys.todo, 'pagos-en-revision'] as const,
  listaPagosEnRevision: (consulta: ConsultaMisPedidos) =>
    [...pedidosKeys.pagosEnRevision(), consulta] as const,
};
