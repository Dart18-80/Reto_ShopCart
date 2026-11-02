import { SpanStatusCode } from '@opentelemetry/api';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearPlanificador, type Tarea } from '../../../../src/shared/jobs/index.js';
import { usarTelemetriaEnMemoria } from '../../telemetria-en-memoria.js';

const telemetria = usarTelemetriaEnMemoria();
const logger = pino({ level: 'silent' });
const INSTANCIA = 'api-2';

/** Ejecuta la tarea una vez (al arrancar) y detiene el planificador. */
async function ejecutarUnaVez(nombre: string, ejecutar: Tarea['ejecutar']) {
  const planificador = crearPlanificador(
    [{ nombre, intervaloMs: 3_600_000, alIniciar: true, ejecutar: vi.fn(ejecutar) }],
    logger,
    INSTANCIA,
  );
  planificador.iniciar();
  await planificador.detener();
}

describe('planificador con trazas y métricas (E9-H01)', () => {
  it('cada ejecución es un span con la réplica y si tomó el bloqueo', async () => {
    await ejecutarUnaVez('Prueba.ConBloqueo', () => Promise.resolve({ procesadas: 1 }));
    await ejecutarUnaVez('Prueba.SinBloqueo', () => Promise.resolve(null));

    expect(
      telemetria
        .spans()
        .map((s) => [
          s.name,
          s.attributes['shopcart.replica'],
          s.attributes['shopcart.tarea.bloqueo_tomado'],
        ]),
    ).toEqual([
      ['tarea Prueba.ConBloqueo', INSTANCIA, true],
      ['tarea Prueba.SinBloqueo', INSTANCIA, false],
    ]);
  });

  it('una tarea que falla deja su span en error', async () => {
    await ejecutarUnaVez('Prueba.Falla', () => Promise.reject(new Error('la base no respondió')));

    expect(telemetria.spans()[0]?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('cuenta las ejecuciones por tarea y resultado', async () => {
    await ejecutarUnaVez('Prueba.Conteo', () => Promise.resolve({ procesadas: 2 }));
    await ejecutarUnaVez('Prueba.Conteo', () => Promise.resolve({ procesadas: 0 }));
    await ejecutarUnaVez('Prueba.Conteo', () => Promise.resolve(null));
    await ejecutarUnaVez('Prueba.Conteo', () => Promise.reject(new Error('x')));

    const puntos = (await telemetria.metricas()).get('shopcart.tareas.ejecuciones') ?? [];
    const delConteo = puntos.filter((p) => p.atributos.tarea === 'Prueba.Conteo');
    expect(Object.fromEntries(delConteo.map((p) => [p.atributos.resultado, p.valor]))).toEqual({
      ConTrabajo: 1,
      SinTrabajo: 1,
      Omitida: 1,
      Fallida: 1,
    });
  });
});
