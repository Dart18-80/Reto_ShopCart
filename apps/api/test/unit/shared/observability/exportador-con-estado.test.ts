import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { conRegistroDeEstado } from '../../../../src/shared/observability/exportador-con-estado.js';

function exportadorFalso(resultados: ExportResult[]) {
  return {
    export: vi.fn((_lote: unknown, alTerminar: (resultado: ExportResult) => void) => {
      alTerminar(resultados.shift() ?? { code: ExportResultCode.SUCCESS });
    }),
    shutdown: vi.fn(() => Promise.resolve()),
    marca: 'propia',
  };
}

const fallo: ExportResult = {
  code: ExportResultCode.FAILED,
  error: new Error('connect ETIMEDOUT'),
};
const exito: ExportResult = { code: ExportResultCode.SUCCESS };

function exportar(exportador: { export: (lote: unknown, cb: (r: ExportResult) => void) => void }) {
  return new Promise<ExportResult>((resolver) => {
    exportador.export([], resolver);
  });
}

describe('conRegistroDeEstado (E9-H01: sin el colector, ningún error repetido)', () => {
  it('registra una sola advertencia mientras el colector no responde y una línea al volver', async () => {
    const logger = pino({ level: 'silent' });
    const advertencia = vi.spyOn(logger, 'warn');
    const informacion = vi.spyOn(logger, 'info');
    const exportador = conRegistroDeEstado(
      exportadorFalso([fallo, fallo, fallo, exito, exito]),
      'trazas',
      logger,
    );

    for (let i = 0; i < 5; i++) await exportar(exportador);

    expect(advertencia).toHaveBeenCalledTimes(1);
    expect(advertencia).toHaveBeenCalledWith(
      { senal: 'trazas', causa: 'connect ETIMEDOUT' },
      expect.stringContaining('no está disponible'),
    );
    expect(informacion).toHaveBeenCalledTimes(1);
    expect(informacion).toHaveBeenCalledWith(
      { senal: 'trazas' },
      expect.stringContaining('disponible'),
    );
  });

  it('entrega el resultado original y conserva los demás métodos del exportador', async () => {
    const original = exportadorFalso([fallo]);
    const exportador = conRegistroDeEstado(original, 'logs', pino({ level: 'silent' }));

    const resultado = await exportar(exportador);
    await exportador.shutdown();

    expect(resultado).toBe(fallo);
    expect(original.shutdown).toHaveBeenCalledTimes(1);
    expect(exportador.marca).toBe('propia');
  });
});
