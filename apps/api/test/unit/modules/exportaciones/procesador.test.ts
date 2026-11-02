import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { Decimal } from 'decimal.js';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  CONCURRENCIA_MAXIMA_POR_REPLICA,
  crearProcesadorExportaciones,
  MAX_INTENTOS_EXPORTACION,
} from '../../../../src/modules/exportaciones/exportaciones.procesador.js';
import { LIMITE_FILAS_PDF } from '../../../../src/modules/exportaciones/exportaciones.generadores.js';
import type { ExportacionTomada } from '../../../../src/modules/exportaciones/exportaciones.types.js';
import type { ReportesService } from '../../../../src/modules/reportes/index.js';
import type { AlmacenArchivos } from '../../../../src/shared/almacen/index.js';
import { ejecutarConContexto, obtenerContexto } from '../../../../src/shared/http/index.js';

const tomada = (cambios: Partial<ExportacionTomada> = {}): ExportacionTomada => ({
  idExportacion: 41,
  idUsuario: 7,
  reporte: 'top-productos',
  formato: 'xlsx',
  filtros: { desde: '2026-10-01', hasta: '2026-10-31' },
  intentos: 1,
  token: 'token-1',
  ...cambios,
});

function almacenEnMemoria() {
  const archivos = new Map<string, Buffer>();
  const almacen = {
    guardar: vi.fn(async (nombre: string, origen: Readable) => {
      const contenido = await buffer(origen);
      archivos.set(nombre, contenido);
      return { tamanoBytes: contenido.length };
    }),
    leer: vi.fn((nombre: string) =>
      Promise.resolve(Readable.from([archivos.get(nombre) ?? Buffer.alloc(0)])),
    ),
    borrar: vi.fn((nombre: string) => {
      archivos.delete(nombre);
      return Promise.resolve();
    }),
    listar: vi.fn(() =>
      Promise.resolve([...archivos.keys()].map((nombre) => ({ nombre, modificado: new Date() }))),
    ),
  } satisfies AlmacenArchivos;
  return { almacen, archivos };
}

function preparar(colas: ExportacionTomada[] = [tomada()]) {
  const pendientes = [...colas];
  const repositorio = {
    tomar: vi.fn(() => Promise.resolve(pendientes.shift() ?? null)),
    completar: vi.fn(() => Promise.resolve(true)),
    registrarFallo: vi.fn((_t: ExportacionTomada, _error: string, definitivo: boolean) =>
      Promise.resolve({
        estado: definitivo ? ('Fallida' as const) : ('Pendiente' as const),
        aplicado: true,
      }),
    ),
  };
  const reportes = {
    resumen: vi.fn(),
    ventasPorPeriodo: vi.fn((): ReturnType<ReportesService['ventasPorPeriodo']> =>
      Promise.resolve([]),
    ),
    ventasPorCategoria: vi.fn(() => Promise.resolve([])),
    topProductos: vi.fn(() =>
      Promise.resolve([
        { idProducto: 1, producto: 'Tenis', unidades: 2, ventas: new Decimal('99.90') },
      ]),
    ),
    carritosAbandonados: vi.fn(),
  } satisfies Record<keyof ReportesService, unknown>;
  const { almacen, archivos } = almacenEnMemoria();
  const procesador = crearProcesadorExportaciones({
    repositorio,
    reportes,
    almacen,
    logger: pino({ level: 'silent' }),
    reloj: { ahora: () => new Date('2026-11-02T15:30:00.000Z') },
  });
  return { procesador, repositorio, reportes, almacen, archivos };
}

describe('procesador de exportaciones (E7-H05, A-24)', () => {
  it('toma, genera el archivo en el almacén y la completa con su token', async () => {
    const { procesador, repositorio, archivos } = preparar();

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ completadas: 1 });
    expect(archivos.size).toBe(1);
    const [referencia] = [...archivos.keys()];
    expect(referencia).toMatch(/^41-[0-9a-f-]{36}\.xlsx$/);
    expect(repositorio.completar).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'token-1' }),
      referencia,
      archivos.get(referencia ?? '')?.length,
      24,
    );
  });

  it('si otra réplica la retomó (el token ya no es el vigente), borra su archivo: queda uno solo', async () => {
    const { procesador, repositorio, archivos, almacen } = preparar();
    repositorio.completar.mockResolvedValueOnce(false);

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ desplazadas: 1, completadas: 0 });
    expect(almacen.borrar).toHaveBeenCalledTimes(1);
    expect(archivos.size).toBe(0);
  });

  it('si la base falla al completarla, no borra el archivo (el COMMIT pudo ocurrir) y la cuenta como error', async () => {
    const { procesador, repositorio, archivos } = preparar();
    repositorio.completar.mockRejectedValueOnce(new Error('base caída'));

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ errores: 1, completadas: 0 });
    expect(archivos.size).toBe(1);
  });

  it('si el almacén falla antes de leer el archivo, el generador no queda colgado: se registra para reintentar', async () => {
    const { procesador, repositorio, almacen } = preparar();
    almacen.guardar.mockRejectedValueOnce(new Error('volumen sin permisos'));

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ reintentos: 1 });
    expect(repositorio.registrarFallo).toHaveBeenCalledTimes(1);
  });

  it('si tomar de la cola falla, libera el lugar: la siguiente vez vuelve a tomar', async () => {
    const { procesador, repositorio } = preparar();
    repositorio.tomar.mockRejectedValueOnce(new Error('base caída'));

    await expect(procesador.procesarPendientes()).rejects.toThrow('base caída');
    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ completadas: 1 });
  });

  it('detener deja de tomar y espera lo que está generando', async () => {
    const { procesador, repositorio, reportes } = preparar([
      tomada({ idExportacion: 1 }),
      tomada({ idExportacion: 2 }),
    ]);
    let liberar = (): void => undefined;
    reportes.topProductos.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        liberar = resolve;
      });
      return [];
    });
    const enCurso = procesador.procesarPendientes();
    await vi.waitFor(() => {
      expect(reportes.topProductos).toHaveBeenCalled();
    });

    let detenido = false;
    const deteniendo = procesador.detener().then(() => {
      detenido = true;
    });
    await Promise.resolve();
    const antesDeTerminar = detenido;
    liberar();
    await Promise.all([enCurso, deteniendo]);
    const despues = await procesador.procesarPendientes();

    expect(antesDeTerminar).toBe(false);
    expect(detenido).toBe(true);
    expect(despues).toMatchObject({ completadas: 0 });
    expect(repositorio.tomar.mock.calls.length).toBeLessThanOrEqual(
      CONCURRENCIA_MAXIMA_POR_REPLICA,
    );
  });

  it('un error al leer el reporte se registra para reintentar, con un mensaje sin detalles internos', async () => {
    const { procesador, repositorio, reportes } = preparar();
    reportes.topProductos.mockRejectedValueOnce(new Error('timeout de SQL Server'));

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ reintentos: 1 });
    expect(repositorio.registrarFallo).toHaveBeenCalledWith(
      expect.objectContaining({ idExportacion: 41 }),
      'No se pudo generar el archivo; se volverá a intentar.',
      false,
      MAX_INTENTOS_EXPORTACION,
    );
  });

  it('un reporte que pasa el límite de filas del formato falla de forma definitiva, con su causa', async () => {
    const { procesador, repositorio, reportes } = preparar([
      tomada({ reporte: 'ventas', formato: 'pdf', filtros: { agrupacion: 'dia' } }),
    ]);
    reportes.ventasPorPeriodo.mockResolvedValueOnce(
      Array.from({ length: LIMITE_FILAS_PDF + 1 }, (_, i) => ({
        periodo: String(i),
        ventas: new Decimal(1),
        pedidos: 1,
      })),
    );

    const resumen = await procesador.procesarPendientes();

    expect(resumen).toMatchObject({ fallidas: 1 });
    expect(repositorio.registrarFallo).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(`más de ${String(LIMITE_FILAS_PDF)} filas`),
      true,
      MAX_INTENTOS_EXPORTACION,
    );
  });

  it('nunca procesa más de la concurrencia máxima de la réplica a la vez', async () => {
    const muchas = Array.from({ length: 5 }, (_, i) => tomada({ idExportacion: i + 1 }));
    const { procesador, repositorio, reportes } = preparar(muchas);
    let liberar = (): void => undefined;
    const bloqueo = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    reportes.topProductos.mockImplementation(async () => {
      await bloqueo;
      return [];
    });

    // Una sola llamada con cinco pendientes toma exactamente el máximo.
    const primera = procesador.procesarPendientes();
    await vi.waitFor(() => {
      expect(reportes.topProductos).toHaveBeenCalledTimes(CONCURRENCIA_MAXIMA_POR_REPLICA);
    });
    const tomadasPorLaPrimera = repositorio.tomar.mock.calls.length;
    // Otra llamada (la tarea, mientras el POST genera) con la réplica llena ni siquiera toma.
    await procesador.procesarPendientes();
    const tomadasConLaReplicaLlena = repositorio.tomar.mock.calls.length;
    liberar();
    await primera;

    expect(tomadasPorLaPrimera).toBe(CONCURRENCIA_MAXIMA_POR_REPLICA);
    expect(tomadasConLaReplicaLlena).toBe(CONCURRENCIA_MAXIMA_POR_REPLICA);
  });

  it('la cola corre como Sistema aunque la dispare una petición; el reporte, como el Admin que la pidió', async () => {
    const { procesador, repositorio, reportes } = preparar();
    const contextos: unknown[] = [];
    repositorio.tomar.mockImplementationOnce(() => {
      contextos.push(obtenerContexto());
      return Promise.resolve(tomada());
    });
    reportes.topProductos.mockImplementationOnce(() => {
      contextos.push(obtenerContexto());
      return Promise.resolve([]);
    });

    await ejecutarConContexto({ requestId: 'r-1', idUsuario: 99, rol: 'Administrador' }, () =>
      procesador.procesarPendientes(),
    );

    expect(contextos[0]).toBeUndefined();
    expect(contextos[1]).toMatchObject({ idUsuario: 7, rol: 'Administrador' });
  });
});
