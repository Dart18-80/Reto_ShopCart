import type { ReporteDashboard, SolicitarExportacion } from '@shopcart/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guardarRespuesta, refrescar } from '../../../shared/api';
import { guardarArchivo } from '../archivos';
import {
  descargarExportacion,
  listarExportaciones,
  obtenerExportacion,
  solicitarExportacion,
  type ConsultaExportaciones,
  type Exportacion,
} from '../exportaciones.api';
import { exportacionesKeys } from '../exportaciones.keys';

// El backend pide volver a consultar cada 2 s (Retry-After) mientras una exportación no termina; la lista no trae
// el encabezado y usa la misma cadencia.
const CONSULTA_MIENTRAS_PROCESA_MS = 2_000;

const enCurso = ({ estado }: Exportacion) => estado === 'Pendiente' || estado === 'Procesando';

export function useExportaciones(consulta: ConsultaExportaciones) {
  return useQuery({
    queryKey: exportacionesKeys.lista(consulta),
    queryFn: () => listarExportaciones(consulta),
    placeholderData: keepPreviousData,
    refetchInterval: ({ state }) =>
      state.data?.datos.some(enCurso) ? CONSULTA_MIENTRAS_PROCESA_MS : false,
  });
}

/** Sigue una exportación hasta que termina, con la cadencia que pide el backend. */
export function useExportacion(idExportacion: number) {
  return useQuery({
    queryKey: exportacionesKeys.detalle(idExportacion),
    queryFn: () => obtenerExportacion(idExportacion),
    refetchInterval: ({ state }) => state.data?.reintentarEnMs ?? false,
  });
}

export function useSolicitarExportacion(reporte: ReporteDashboard) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (solicitud: SolicitarExportacion) => solicitarExportacion(reporte, solicitud),
    onSuccess: async (seguimiento) => {
      await guardarRespuesta(
        queryClient,
        exportacionesKeys.detalle(seguimiento.exportacion.idExportacion),
        seguimiento,
      );
      await refrescar(queryClient, { queryKey: exportacionesKeys.listas() });
    },
  });
}

export function useDescargarExportacion() {
  return useMutation({
    mutationFn: async (exportacion: Exportacion) => {
      const { archivo, nombre } = await descargarExportacion(exportacion);
      guardarArchivo(archivo, nombre);
    },
  });
}
