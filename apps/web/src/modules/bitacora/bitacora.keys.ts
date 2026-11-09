import type { ConsultaBitacora } from '@shopcart/shared';

export const bitacoraKeys = {
  todo: ['bitacora'] as const,
  lista: (consulta: ConsultaBitacora) => [...bitacoraKeys.todo, 'lista', consulta] as const,
};
