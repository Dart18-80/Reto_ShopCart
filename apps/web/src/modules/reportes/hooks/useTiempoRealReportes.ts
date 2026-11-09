import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { refrescar } from '../../../shared/api';
import { abrirEventosReportes } from '../reportes.api';
import { reportesDelDominio, reportesKeys } from '../reportes.keys';
import { crearTiempoReal, type EstadoTiempoReal } from '../tiempoReal';

/**
 * M11-H02 (FE-11): mientras el dashboard está abierto, escucha los avisos del backend y vuelve a pedir solo los
 * reportes del dominio que cambió; los datos anteriores siguen a la vista mientras llegan los nuevos. Con la
 * pestaña oculta la conexión se cierra y al volver se reabre con `Last-Event-ID`.
 */
export function useTiempoRealReportes(): EstadoTiempoReal {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoTiempoReal>('conectando');

  useEffect(() => {
    const tiempoReal = crearTiempoReal({
      abrir: abrirEventosReportes,
      alCambio: (dominio) => {
        for (const reporte of reportesDelDominio(dominio)) {
          void refrescar(queryClient, { queryKey: reportesKeys.seccion(reporte) });
        }
      },
      alRecargar: () => {
        void refrescar(queryClient, { queryKey: reportesKeys.todo });
      },
      alEstado: setEstado,
    });
    const alCambiarVisibilidad = () => {
      if (document.hidden) tiempoReal.pausar();
      else tiempoReal.reanudar();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    alCambiarVisibilidad();
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      tiempoReal.detener();
    };
  }, [queryClient]);

  return estado;
}
