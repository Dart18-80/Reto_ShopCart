import type { ConsultaCupones } from '@shopcart/shared';

export const cuponesKeys = {
  todo: ['cupones'] as const,
  lista: (consulta: ConsultaCupones) => [...cuponesKeys.todo, 'lista', consulta] as const,
};
