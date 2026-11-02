import type { Logger } from 'pino';
import {
  ATRIBUTOS,
  enSpan,
  metricasDeNegocio,
  type ResultadoTareaMetrica,
} from '../observability/index.js';

/** Lo que hizo una ejecución (conteos para el log); null si la otra réplica tenía el sp_getapplock (A-04). */
export type ResultadoTarea = Readonly<Record<string, number>> | null;

export interface Tarea {
  nombre: string;
  intervaloMs: number;
  /** Además de cada intervalo, una vez al arrancar la réplica (las tareas de cada hora). */
  alIniciar?: boolean;
  ejecutar: () => Promise<ResultadoTarea>;
}

export interface Planificador {
  iniciar(): void;
  /** Deja de programar ejecuciones y espera las que están en curso (apagado ordenado). */
  detener(): Promise<void>;
}

function resultadoParaMetrica(resultado: ResultadoTarea): ResultadoTareaMetrica {
  if (resultado === null) return 'Omitida';
  return Object.values(resultado).some((cantidad) => cantidad !== 0) ? 'ConTrabajo' : 'SinTrabajo';
}

/**
 * A-04 (01 §8): cada réplica ejecuta todas las tareas; la coordinación entre réplicas la hace el
 * sp_getapplock de cada SP, así que el planificador no guarda estado compartido (RNF-2).
 * E9-H01: cada ejecución es un span con la réplica y si tomó el bloqueo, y una métrica por resultado.
 */
export function crearPlanificador(
  tareas: readonly Tarea[],
  logger: Logger,
  instancia = 'local',
): Planificador {
  const temporizadores: NodeJS.Timeout[] = [];
  const enCurso = new Map<string, Promise<void>>();

  function ejecutarConSpan(tarea: Tarea): Promise<ResultadoTarea> {
    return enSpan(`tarea ${tarea.nombre}`, { [ATRIBUTOS.replica]: instancia }, async (span) => {
      const resultado = await tarea.ejecutar();
      span.setAttribute(ATRIBUTOS.bloqueoTomado, resultado !== null);
      return resultado;
    });
  }

  async function ejecutar(tarea: Tarea): Promise<void> {
    try {
      const resultado = await ejecutarConSpan(tarea);
      metricasDeNegocio.tareaEjecutada(tarea.nombre, resultadoParaMetrica(resultado));
      // Decisión del PO (cierre de la Fase 1): en info solo cuando hubo trabajo; lo vacío, en debug.
      if (resultado === null) {
        logger.debug({ tarea: tarea.nombre }, 'Tarea omitida: otra réplica la está ejecutando');
      } else if (Object.values(resultado).some((cantidad) => cantidad !== 0)) {
        logger.info({ tarea: tarea.nombre, ...resultado }, 'Tarea ejecutada');
      } else {
        logger.debug({ tarea: tarea.nombre }, 'Tarea ejecutada sin trabajo');
      }
    } catch (error) {
      metricasDeNegocio.tareaEjecutada(tarea.nombre, 'Fallida');
      logger.error(
        { err: error, tarea: tarea.nombre },
        'La tarea falló; se reintenta en su siguiente turno',
      );
    }
  }

  function disparar(tarea: Tarea): void {
    // Dentro de una réplica no se superponen dos ejecuciones de la misma tarea.
    if (enCurso.has(tarea.nombre)) {
      logger.warn({ tarea: tarea.nombre }, 'Turno omitido: la ejecución anterior sigue en curso');
      return;
    }
    const ejecucion = ejecutar(tarea).finally(() => enCurso.delete(tarea.nombre));
    enCurso.set(tarea.nombre, ejecucion);
  }

  return {
    iniciar() {
      if (temporizadores.length > 0) return;
      for (const tarea of tareas) {
        const temporizador = setInterval(() => {
          disparar(tarea);
        }, tarea.intervaloMs);
        temporizador.unref();
        temporizadores.push(temporizador);
        if (tarea.alIniciar === true) disparar(tarea);
      }
    },

    async detener() {
      for (const temporizador of temporizadores) clearInterval(temporizador);
      temporizadores.length = 0;
      await Promise.allSettled(enCurso.values());
    },
  };
}
