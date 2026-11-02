import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import type { Logger } from 'pino';

interface Exportador {
  export(lote: never, alTerminar: (resultado: ExportResult) => void): void;
}

/**
 * E9-H01: el colector (perfil `observabilidad`) es opcional. Sin él, cada lote falla; se registra una sola
 * advertencia al dejar de responder y una línea al volver, como el adaptador de Redis. Los demás métodos del
 * exportador (shutdown, forceFlush, temporalidad de las métricas) pasan tal cual.
 */
export function conRegistroDeEstado<E extends Exportador>(
  exportador: E,
  senal: string,
  logger: Pick<Logger, 'warn' | 'info'>,
): E {
  let disponible = true;

  function exportar(lote: never, alTerminar: (resultado: ExportResult) => void): void {
    exportador.export(lote, (resultado) => {
      const exitoso = resultado.code === ExportResultCode.SUCCESS;
      if (exitoso !== disponible) {
        disponible = exitoso;
        if (exitoso) {
          logger.info({ senal }, 'El colector de telemetría está disponible otra vez');
        } else {
          logger.warn(
            { senal, causa: resultado.error?.message },
            'El colector de telemetría no está disponible: se descarta lo que se exporte hasta que vuelva',
          );
        }
      }
      alTerminar(resultado);
    });
  }

  return new Proxy(exportador, {
    get(objetivo, propiedad) {
      if (propiedad === 'export') return exportar;
      const valor: unknown = Reflect.get(objetivo, propiedad, objetivo);
      // typeof ya comprobó que es una función; el cast solo le da una firma para poder enlazarla.
      return typeof valor === 'function'
        ? (valor as (...args: unknown[]) => unknown).bind(objetivo)
        : valor;
    },
  });
}
