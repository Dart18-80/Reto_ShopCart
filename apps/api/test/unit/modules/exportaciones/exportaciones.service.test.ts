import { Readable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  crearExportacionesService,
  MAX_EXPORTACIONES_PENDIENTES,
} from '../../../../src/modules/exportaciones/exportaciones.service.js';
import type { Exportacion } from '../../../../src/modules/exportaciones/exportaciones.types.js';
import { ArchivoNoEncontrado } from '../../../../src/shared/almacen/index.js';

const EXPORTACION: Exportacion = {
  idExportacion: 5,
  reporte: 'top-productos',
  formato: 'xlsx',
  filtros: {},
  estado: 'Completada',
  intentos: 1,
  error: null,
  referenciaArchivo: '5-abc.xlsx',
  tamanoBytes: 2048,
  fechaCreacion: new Date('2026-11-02T15:00:00.000Z'),
  // 15:30 UTC = 09:30 en Guatemala.
  fechaFinalizacion: new Date('2026-11-02T15:30:00.000Z'),
  fechaExpiracion: new Date('2026-11-03T15:30:00.000Z'),
};

// Antes de que venza la exportación de prueba (fechaExpiracion: 2026-11-03 15:30 UTC).
const AHORA = new Date('2026-11-02T18:00:00.000Z');

function preparar(exportacion: Exportacion | null = EXPORTACION, nueva = true) {
  const repositorio = {
    solicitar: vi.fn((..._argumentos: unknown[]) =>
      Promise.resolve({ exportacion: EXPORTACION, nueva }),
    ),
    obtener: vi.fn(() => Promise.resolve(exportacion)),
    listar: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
  };
  const almacen = { leer: vi.fn(() => Promise.resolve(Readable.from(['contenido']))) };
  const procesador = {
    procesarPendientes: vi.fn(() =>
      Promise.resolve({ completadas: 0, reintentos: 0, fallidas: 0, desplazadas: 0, errores: 0 }),
    ),
  };
  const servicio = crearExportacionesService({
    repositorio,
    almacen,
    procesador,
    logger: pino({ level: 'silent' }),
    reloj: { ahora: () => AHORA },
  });
  return { servicio, repositorio, almacen, procesador };
}

describe('exportaciones.service (E7-H05)', () => {
  it('valida los filtros con el esquema del reporte del dashboard', async () => {
    const { servicio, repositorio } = preparar();

    const error = await servicio
      .solicitar('ventas', { formato: 'xlsx', filtros: { agrupacion: 'anio' } })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'VALIDACION_FALLIDA', status: 400 });
    expect(JSON.stringify(error)).toContain('body.filtros.agrupacion');
    expect(repositorio.solicitar).not.toHaveBeenCalled();
  });

  it('normaliza los filtros: el mismo rango en otro orden da el mismo hash y el mismo JSON', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.solicitar('top-productos', {
      formato: 'pdf',
      filtros: { hasta: '2026-10-31', desde: '2026-10-01' },
    });
    await servicio.solicitar('top-productos', {
      formato: 'pdf',
      filtros: { desde: '2026-10-01', hasta: '2026-10-31' },
    });

    const [primera, segunda] = repositorio.solicitar.mock.calls;
    expect(primera?.[2]).toBe('{"desde":"2026-10-01","hasta":"2026-10-31"}');
    expect(primera?.[2]).toBe(segunda?.[2]);
    expect(primera?.[3]).toEqual(segunda?.[3]);
    expect(primera?.[4]).toBe(MAX_EXPORTACIONES_PENDIENTES);
  });

  it('una solicitud nueva se procesa de inmediato; una agrupada con otra existente no', async () => {
    const nueva = preparar(EXPORTACION, true);
    const agrupada = preparar(EXPORTACION, false);

    await nueva.servicio.solicitar('resumen', { formato: 'xlsx', filtros: {} });
    await agrupada.servicio.solicitar('resumen', { formato: 'xlsx', filtros: {} });

    expect(nueva.procesador.procesarPendientes).toHaveBeenCalledTimes(1);
    expect(agrupada.procesador.procesarPendientes).not.toHaveBeenCalled();
  });

  it('una exportación ajena o inexistente es NO_ENCONTRADO (RF-01)', async () => {
    const { servicio } = preparar(null);

    await expect(servicio.obtener(5)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      status: 404,
    });
  });

  it.each([
    ['Pendiente', 'EXPORTACION_NO_LISTA', 409],
    ['Procesando', 'EXPORTACION_NO_LISTA', 409],
    ['Fallida', 'EXPORTACION_NO_LISTA', 409],
    ['Expirada', 'EXPORTACION_EXPIRADA', 410],
  ] as const)('el archivo de una exportación %s responde %s', async (estado, codigo, status) => {
    const { servicio } = preparar({ ...EXPORTACION, estado });

    await expect(servicio.archivo(5)).rejects.toMatchObject({ codigo, status });
  });

  it('el archivo de una Completada lleva un nombre del servidor: el reporte y la fecha local', async () => {
    const { servicio } = preparar();

    const archivo = await servicio.archivo(5);

    expect(archivo.nombreDescarga).toBe('top-productos_2026-11-02_0930.xlsx');
    expect(archivo.tipoContenido).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(archivo.tamanoBytes).toBe(2048);
  });

  it('una Completada que ya venció (la purga todavía no pasó) responde EXPORTACION_EXPIRADA', async () => {
    const { servicio, almacen } = preparar({
      ...EXPORTACION,
      fechaExpiracion: new Date('2026-11-02T17:59:59.000Z'),
    });

    await expect(servicio.archivo(5)).rejects.toMatchObject({
      codigo: 'EXPORTACION_EXPIRADA',
      status: 410,
    });
    expect(almacen.leer).not.toHaveBeenCalled();
  });

  it('si el procesamiento inmediato falla, la solicitud igual responde (la tarea la retoma)', async () => {
    const { servicio, procesador } = preparar();
    procesador.procesarPendientes.mockRejectedValueOnce(new Error('base caída'));

    const { exportacion } = await servicio.solicitar('resumen', { formato: 'xlsx', filtros: {} });
    await new Promise((listo) => setImmediate(listo));

    expect(exportacion.idExportacion).toBe(5);
  });

  it('una Completada cuyo archivo ya no está responde EXPORTACION_EXPIRADA', async () => {
    const { servicio, almacen } = preparar();
    almacen.leer.mockRejectedValueOnce(new ArchivoNoEncontrado('5-abc.xlsx'));

    await expect(servicio.archivo(5)).rejects.toMatchObject({ codigo: 'EXPORTACION_EXPIRADA' });
  });
});
