import type { ConsultaBusqueda } from '@shopcart/shared';

export const catalogoKeys = {
  todo: ['catalogo'] as const,
  busquedas: () => [...catalogoKeys.todo, 'busqueda'] as const,
  busqueda: (consulta: ConsultaBusqueda) => [...catalogoKeys.busquedas(), consulta] as const,
  categorias: () => [...catalogoKeys.todo, 'categorias'] as const,
};
