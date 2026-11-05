import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ParametrosUrl } from './useParametrosUrl';

/**
 * FE-06: una página fuera de rango (un enlace viejo, o filtros que dejaron menos resultados) salta a la última que
 * existe; con total 0, a la 1 (nunca a la 0). Reemplaza la entrada del historial: es una corrección.
 */
export function usePaginaEnRango<C extends { pagina: number }>(
  consulta: UseQueryResult<{ paginacion: { totalPaginas: number } }>,
  parametros: ParametrosUrl<C>,
) {
  const paginacion = consulta.isPlaceholderData ? undefined : consulta.data?.paginacion;
  const ultimaPagina = paginacion ? Math.max(paginacion.totalPaginas, 1) : undefined;
  const { valores, cambiar } = parametros;

  useEffect(() => {
    if (ultimaPagina !== undefined && valores.pagina > ultimaPagina) {
      // C extiende { pagina: number }: el cambio es de ese campo, con ese tipo.
      cambiar({ pagina: ultimaPagina } as Partial<C>, { historial: 'reemplazar' });
    }
  }, [ultimaPagina, valores.pagina, cambiar]);
}
