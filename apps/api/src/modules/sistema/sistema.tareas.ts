import type { Tarea } from '../../shared/jobs/index.js';
import type { SistemaRepository } from './sistema.repository.js';

// 01 §8: la purga corre cada hora y borra las llaves de idempotencia de más de 24 h.
const UNA_HORA_MS = 3_600_000;
const HORAS_VIGENCIA_LLAVE = 24;

/** A-04: las tareas periódicas del sistema (las arranca server.ts). */
export function tareasSistema(
  repositorio: Pick<SistemaRepository, 'purgarSolicitudesIdempotentes'>,
): Tarea[] {
  return [
    {
      nombre: 'Sistema.PurgarSolicitudesIdempotentes',
      intervaloMs: UNA_HORA_MS,
      async ejecutar() {
        const solicitudesPurgadas =
          await repositorio.purgarSolicitudesIdempotentes(HORAS_VIGENCIA_LLAVE);
        return solicitudesPurgadas === null ? null : { solicitudesPurgadas };
      },
    },
  ];
}
