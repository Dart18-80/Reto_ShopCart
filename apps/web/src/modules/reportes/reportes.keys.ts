import type { ConsultaCarritos, ConsultaVentas, RangoDeFechas } from '@shopcart/shared';
import type { Dominio } from './tiempoReal';

type Seccion = 'resumen' | 'ventas' | 'categorias' | 'top' | 'carritos';

const seccion = (nombre: Seccion) => ['reportes', nombre] as const;

export const reportesKeys = {
  todo: ['reportes'] as const,
  seccion,
  resumen: (rango: RangoDeFechas) => [...seccion('resumen'), rango] as const,
  ventas: (consulta: ConsultaVentas) => [...seccion('ventas'), consulta] as const,
  categorias: (rango: RangoDeFechas) => [...seccion('categorias'), rango] as const,
  top: (rango: RangoDeFechas) => [...seccion('top'), rango] as const,
  carritos: (consulta: ConsultaCarritos) => [...seccion('carritos'), consulta] as const,
};

/**
 * 05 §11 (A-11): qué reportes cambian con cada dominio, como DEPENDENCIAS en reportes.cache.ts del backend. El
 * resumen depende de los dos porque también cuenta los carritos abandonados.
 */
export const SECCIONES_POR_DOMINIO: Record<Dominio, readonly Seccion[]> = {
  ventas: ['resumen', 'ventas', 'categorias', 'top'],
  carritos: ['resumen', 'carritos'],
};
