import type { ConsultaExistencias } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listarExistencias, obtenerConciliacion } from '../inventario.api';
import { inventarioKeys } from '../inventario.keys';

const CONSULTA_DE_UNA_VARIANTE = {
  pagina: 1,
  tamano: 1,
  orden: 'disponible',
  direccion: 'asc',
} as const satisfies Omit<ConsultaExistencias, 'variante'>;

/** FE-06: al cambiar la búsqueda, el orden o la página se conserva la tabla anterior mientras llega la nueva. */
export function useExistencias(consulta: ConsultaExistencias) {
  return useQuery({
    queryKey: inventarioKeys.listaExistencias(consulta),
    queryFn: () => listarExistencias(consulta),
    placeholderData: keepPreviousData,
  });
}

/** N-07: las variantes cuya existencia física no coincide con su kardex; vacía es lo esperado. */
export function useConciliacion() {
  return useQuery({
    queryKey: inventarioKeys.conciliacion(),
    queryFn: obtenerConciliacion,
  });
}

/**
 * La existencia de una variante, pedida por su ID: el diálogo de la variante no depende de que su fila siga en
 * la página de la tabla después de un ajuste (el orden por disponible la puede mover).
 */
export function useExistenciaDeVariante(idVariante: number) {
  return useQuery({
    queryKey: inventarioKeys.listaExistencias({
      ...CONSULTA_DE_UNA_VARIANTE,
      variante: idVariante,
    }),
    queryFn: () => listarExistencias({ ...CONSULTA_DE_UNA_VARIANTE, variante: idVariante }),
    select: (lista) => lista.datos[0] ?? null,
  });
}
