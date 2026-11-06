import type { RegistrarAjuste, RegistrarEntrada } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarKardex, registrarAjuste, registrarEntrada } from '../inventario.api';
import { inventarioKeys } from '../inventario.keys';

/** Los movimientos de una variante, del más reciente al más antiguo (como los ordena el SP). */
export function useKardex(idVariante: number, pagina: number) {
  return useQuery({
    queryKey: inventarioKeys.kardex(idVariante, pagina),
    queryFn: () => listarKardex(idVariante, pagina),
    placeholderData: keepPreviousData,
  });
}

/**
 * Un movimiento cambia las existencias, el kardex y la conciliación: se invalida todo el inventario y la página
 * muestra lo que vuelve a responder el backend (sin actualizaciones optimistas).
 */
function useInvalidarInventario() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: inventarioKeys.todo });
}

export function useRegistrarEntrada() {
  const invalidar = useInvalidarInventario();
  return useMutation({
    mutationFn: (cuerpo: RegistrarEntrada) => registrarEntrada(cuerpo),
    onSuccess: invalidar,
  });
}

export function useRegistrarAjuste() {
  const invalidar = useInvalidarInventario();
  return useMutation({
    mutationFn: (cuerpo: RegistrarAjuste) => registrarAjuste(cuerpo),
    onSuccess: invalidar,
  });
}
