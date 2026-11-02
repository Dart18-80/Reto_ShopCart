import type { Logger } from 'pino';

/** Lo que hizo una ejecución (conteos para el log); null si la otra réplica tenía el sp_getapplock (A-04). */
export type ResultadoTarea = Readonly<Record<string, number>> | null;

export interface Tarea {
  nombre: string;
  intervaloMs: number;
  ejecutar: () => Promise<ResultadoTarea>;
}

export interface Planificador {
  iniciar(): void;
  /** Deja de programar ejecuciones y espera las que están en curso (apagado ordenado). */
  detener(): Promise<void>;
}

/**
 * A-04 (01 §8): cada réplica ejecuta todas las tareas; la coordinación entre réplicas la hace el
 * sp_getapplock de cada SP, así que el planificador no guarda estado compartido (RNF-2).
 */
export function crearPlanificador(tareas: readonly Tarea[], logger: Logger): Planificador {
  const temporizadores: NodeJS.Timeout[] = [];
  const enCurso = new Map<string, Promise<void>>();

  async function ejecutar(tarea: Tarea): Promise<void> {
    try {
      const resultado = await tarea.ejecutar();
      if (resultado === null) {
        logger.info({ tarea: tarea.nombre }, 'Tarea omitida: otra réplica la está ejecutando');
      } else {
        logger.info({ tarea: tarea.nombre, ...resultado }, 'Tarea ejecutada');
      }
    } catch (error) {
      logger.error(
        { err: error, tarea: tarea.nombre },
        'La tarea falló; se reintenta en su siguiente turno',
      );
    }
  }

  function disparar(tarea: Tarea): void {
    // Dentro de una réplica no se superponen dos ejecuciones de la misma tarea.
    if (enCurso.has(tarea.nombre)) return;
    const ejecucion = ejecutar(tarea).finally(() => enCurso.delete(tarea.nombre));
    enCurso.set(tarea.nombre, ejecucion);
  }

  return {
    iniciar() {
      for (const tarea of tareas) {
        const temporizador = setInterval(() => {
          disparar(tarea);
        }, tarea.intervaloMs);
        temporizador.unref();
        temporizadores.push(temporizador);
      }
    },

    async detener() {
      for (const temporizador of temporizadores) clearInterval(temporizador);
      temporizadores.length = 0;
      await Promise.allSettled(enCurso.values());
    },
  };
}
