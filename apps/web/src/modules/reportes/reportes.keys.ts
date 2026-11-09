import type { ConsultaCarritos, ConsultaVentas, RangoDeFechas } from '@shopcart/shared';

export const reportesKeys = {
  todo: ['reportes'] as const,
  resumen: (rango: RangoDeFechas) => [...reportesKeys.todo, 'resumen', rango] as const,
  ventas: (consulta: ConsultaVentas) => [...reportesKeys.todo, 'ventas', consulta] as const,
  categorias: (rango: RangoDeFechas) => [...reportesKeys.todo, 'categorias', rango] as const,
  top: (rango: RangoDeFechas) => [...reportesKeys.todo, 'top', rango] as const,
  carritos: (consulta: ConsultaCarritos) => [...reportesKeys.todo, 'carritos', consulta] as const,
};
