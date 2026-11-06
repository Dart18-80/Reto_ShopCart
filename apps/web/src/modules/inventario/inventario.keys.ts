import type { ConsultaExistencias } from '@shopcart/shared';

export const inventarioKeys = {
  todo: ['inventario'] as const,
  existencias: () => [...inventarioKeys.todo, 'existencias'] as const,
  listaExistencias: (consulta: ConsultaExistencias) =>
    [...inventarioKeys.existencias(), consulta] as const,
  conciliacion: () => [...inventarioKeys.todo, 'conciliacion'] as const,
  kardex: (idVariante: number, pagina: number) =>
    [...inventarioKeys.todo, 'kardex', idVariante, pagina] as const,
};
