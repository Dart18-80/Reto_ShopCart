import type { ConsultaExportaciones } from './exportaciones.api';

export const exportacionesKeys = {
  todo: ['exportaciones'] as const,
  listas: () => [...exportacionesKeys.todo, 'lista'] as const,
  lista: (consulta: ConsultaExportaciones) => [...exportacionesKeys.listas(), consulta] as const,
  detalle: (idExportacion: number) =>
    [...exportacionesKeys.todo, 'detalle', idExportacion] as const,
};
