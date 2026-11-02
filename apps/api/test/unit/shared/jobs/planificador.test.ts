import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearPlanificador, type Tarea } from '../../../../src/shared/jobs/index.js';
import { crearLogger } from '../../../../src/shared/observability/logger.js';

const INTERVALO_MS = 1000;

function loggerEnMemoria(nivel: 'info' | 'debug' = 'info') {
  const lineas: Record<string, unknown>[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(JSON.parse(fragmento.toString()) as Record<string, unknown>);
      listo();
    },
  });
  return { logger: crearLogger({ destino, nivel }), lineas };
}

function tarea(ejecutar: Tarea['ejecutar']): Tarea {
  return { nombre: 'Prueba.Tarea', intervaloMs: INTERVALO_MS, ejecutar: vi.fn(ejecutar) };
}

describe('planificador de tareas (E5-H04, A-04)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ejecuta cada tarea en su intervalo y registra lo que hizo', async () => {
    const { logger, lineas } = loggerEnMemoria();
    const unaTarea = tarea(() => Promise.resolve({ sesionesExpiradas: 2 }));
    const planificador = crearPlanificador([unaTarea], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 2);
    await planificador.detener();

    expect(unaTarea.ejecutar).toHaveBeenCalledTimes(2);
    expect(lineas).toContainEqual(
      expect.objectContaining({
        tarea: 'Prueba.Tarea',
        sesionesExpiradas: 2,
        msg: 'Tarea ejecutada',
      }),
    );
  });

  it('una ejecución sin trabajo (todo en cero) solo se registra en debug, no en info', async () => {
    const enInfo = loggerEnMemoria('info');
    const enDebug = loggerEnMemoria('debug');
    const vacia = () => Promise.resolve({ sesionesExpiradas: 0, carritosExpirados: 0 });
    const planificadores = [
      crearPlanificador([tarea(vacia)], enInfo.logger),
      crearPlanificador([tarea(vacia)], enDebug.logger),
    ];

    for (const p of planificadores) p.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS);
    await Promise.all(planificadores.map((p) => p.detener()));

    expect(enInfo.lineas).toEqual([]);
    expect(enDebug.lineas).toContainEqual(
      expect.objectContaining({
        level: 20,
        tarea: 'Prueba.Tarea',
        msg: 'Tarea ejecutada sin trabajo',
      }),
    );
  });

  it('si la otra réplica tiene el bloqueo, lo registra en debug (no hubo trabajo en esta)', async () => {
    const { logger, lineas } = loggerEnMemoria('debug');
    const planificador = crearPlanificador([tarea(() => Promise.resolve(null))], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS);
    await planificador.detener();

    expect(lineas).toContainEqual(
      expect.objectContaining({
        level: 20,
        tarea: 'Prueba.Tarea',
        msg: 'Tarea omitida: otra réplica la está ejecutando',
      }),
    );
  });

  it('un error se registra y la tarea vuelve a correr en su siguiente turno', async () => {
    const { logger, lineas } = loggerEnMemoria();
    const fallida = tarea(() => Promise.reject(new Error('base caída')));
    const planificador = crearPlanificador([fallida], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 2);
    await planificador.detener();

    expect(fallida.ejecutar).toHaveBeenCalledTimes(2);
    expect(lineas).toContainEqual(expect.objectContaining({ level: 50, tarea: 'Prueba.Tarea' }));
  });

  it('no superpone dos ejecuciones de la misma tarea en una réplica', async () => {
    const { logger } = loggerEnMemoria();
    let terminar: () => void = () => undefined;
    const lenta = tarea(
      () =>
        new Promise((listo) => {
          terminar = () => {
            listo({});
          };
        }),
    );
    const planificador = crearPlanificador([lenta], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 3);
    terminar();
    await planificador.detener();

    expect(lenta.ejecutar).toHaveBeenCalledTimes(1);
  });

  it('una tarea con alIniciar corre al arrancar y después en cada intervalo; las demás, solo en el intervalo', async () => {
    const { logger } = loggerEnMemoria();
    const horaria = { ...tarea(() => Promise.resolve({})), nombre: 'Horaria', alIniciar: true };
    const comun = tarea(() => Promise.resolve({}));
    const planificador = crearPlanificador([horaria, comun], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    const alArrancar = [
      vi.mocked(horaria.ejecutar).mock.calls.length,
      vi.mocked(comun.ejecutar).mock.calls.length,
    ];
    await vi.advanceTimersByTimeAsync(INTERVALO_MS);
    await planificador.detener();

    expect(alArrancar).toEqual([1, 0]);
    expect(horaria.ejecutar).toHaveBeenCalledTimes(2);
    expect(comun.ejecutar).toHaveBeenCalledTimes(1);
  });

  it('detener espera la ejecución en curso y no programa más', async () => {
    const { logger } = loggerEnMemoria();
    let terminada = false;
    const unaTarea = tarea(async () => {
      await new Promise((listo) => setTimeout(listo, INTERVALO_MS / 2));
      terminada = true;
      return {};
    });
    const planificador = crearPlanificador([unaTarea], logger);

    planificador.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS);
    const deteniendo = planificador.detener();
    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 3);
    await deteniendo;

    expect(terminada).toBe(true);
    expect(unaTarea.ejecutar).toHaveBeenCalledTimes(1);
  });
});
