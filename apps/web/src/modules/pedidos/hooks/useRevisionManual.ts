import type { ConsultaReembolsos, ResolverPago, ResolverReembolso } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listarPagosEnRevision,
  listarReembolsos,
  reintentarReembolso,
  resolverPago,
  resolverReembolso,
  type ConsultaMisPedidos,
} from '../pedidos.api';
import { pedidosKeys } from '../pedidos.keys';
import { refrescar } from '../../../shared/api';

export function useReembolsos(consulta: ConsultaReembolsos) {
  return useQuery({
    queryKey: pedidosKeys.listaReembolsos(consulta),
    queryFn: () => listarReembolsos(consulta),
    placeholderData: keepPreviousData,
  });
}

export function usePagosEnRevision(consulta: ConsultaMisPedidos) {
  return useQuery({
    queryKey: pedidosKeys.listaPagosEnRevision(consulta),
    queryFn: () => listarPagosEnRevision(consulta),
    placeholderData: keepPreviousData,
  });
}

/**
 * Responda lo que responda, el reembolso pudo cambiar (E9-H04: un 409 REEMBOLSO_YA_PROCESADO o
 * REEMBOLSO_SIN_COBRO sí lo movió): la lista se vuelve a pedir y muestra lo que dice el backend.
 */
function useRefrescarReembolsos() {
  const queryClient = useQueryClient();
  return () => refrescar(queryClient, { queryKey: pedidosKeys.reembolsos() });
}

/** M8-H05: el estado nuevo llega de la lista vuelta a pedir, sin recargar la página. */
export function useReintentarReembolso() {
  const refrescar = useRefrescarReembolsos();
  return useMutation({ mutationFn: reintentarReembolso, onSettled: refrescar });
}

export function useResolverReembolso(idReembolso: number) {
  const refrescar = useRefrescarReembolsos();
  return useMutation({
    mutationFn: (cuerpo: ResolverReembolso) => resolverReembolso(idReembolso, cuerpo),
    onSettled: refrescar,
  });
}

/** Resolver un pago puede cancelar su pedido (SinCobro) o crear un reembolso (Reembolsar). */
export function useResolverPago(idIntentoPago: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: ResolverPago) => resolverPago(idIntentoPago, cuerpo),
    onSettled: () =>
      Promise.all([
        refrescar(queryClient, { queryKey: pedidosKeys.pagosEnRevision() }),
        refrescar(queryClient, { queryKey: pedidosKeys.gestion() }),
        refrescar(queryClient, { queryKey: pedidosKeys.reembolsos() }),
      ]),
  });
}
