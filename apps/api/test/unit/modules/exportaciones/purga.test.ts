import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  HORAS_ANTIGUEDAD_HUERFANO,
  tareasExportaciones,
} from '../../../../src/modules/exportaciones/exportaciones.tareas.js';

const AHORA = new Date('2026-11-02T12:00:00.000Z');
const horasAntes = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

function preparar(archivos: { nombre: string; modificado: Date }[], referenciados: string[]) {
  const repositorio = {
    expirar: vi.fn(() =>
      Promise.resolve([] as { idExportacion: number; referenciaArchivo: string }[]),
    ),
    quitarArchivo: vi.fn(() => Promise.resolve()),
    referenciasExistentes: vi.fn((nombres: string[]) =>
      Promise.resolve(new Set(nombres.filter((n) => referenciados.includes(n)))),
    ),
  };
  const almacen = {
    guardar: vi.fn(),
    leer: vi.fn(),
    borrar: vi.fn(() => Promise.resolve()),
    listar: vi.fn(() => Promise.resolve(archivos)),
  };
  const [, purga] = tareasExportaciones({
    procesador: { procesarPendientes: vi.fn() },
    repositorio,
    almacen,
    logger: pino({ level: 'silent' }),
    reloj: { ahora: () => AHORA },
  });
  if (purga === undefined) throw new Error('Falta la tarea de purga');
  return { purga, repositorio, almacen };
}

describe('barrido de archivos huérfanos en la purga (cierre de la Fase 1)', () => {
  it('borra un archivo sin referencia con más de 24 h; nunca uno referenciado ni uno reciente', async () => {
    const { purga, almacen } = preparar(
      [
        { nombre: '1-huerfano.xlsx', modificado: horasAntes(HORAS_ANTIGUEDAD_HUERFANO + 1) },
        { nombre: '2-referenciado.pdf', modificado: horasAntes(HORAS_ANTIGUEDAD_HUERFANO + 5) },
        { nombre: '3-reciente.xlsx', modificado: horasAntes(HORAS_ANTIGUEDAD_HUERFANO - 1) },
      ],
      ['2-referenciado.pdf'],
    );

    const resultado = await purga.ejecutar();

    expect(almacen.borrar).toHaveBeenCalledTimes(1);
    expect(almacen.borrar).toHaveBeenCalledWith('1-huerfano.xlsx');
    expect(resultado).toMatchObject({ huerfanos: 1 });
  });

  it('solo consulta la base por los archivos viejos; sin archivos viejos no la consulta', async () => {
    const { purga, repositorio } = preparar(
      [{ nombre: '3-reciente.xlsx', modificado: horasAntes(1) }],
      [],
    );

    await purga.ejecutar();

    expect(repositorio.referenciasExistentes).not.toHaveBeenCalled();
  });
});
