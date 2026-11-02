import type { Logger } from 'pino';
import type { AlmacenArchivos } from '../../shared/almacen/index.js';
import type { ResultadoTarea, Tarea } from '../../shared/jobs/index.js';
import type { ProcesadorExportaciones } from './exportaciones.procesador.js';
import type { ExportacionesRepository } from './exportaciones.repository.js';

// 01 §8: la cola se revisa seguido (el POST ya dispara el procesamiento; esto recoge lo demás).
const INTERVALO_COLA_MS = 10_000;
const UNA_HORA_MS = 3_600_000;
// Acota una ejecución de la purga; lo que quede lo borra la siguiente.
const MAXIMO_POR_PURGA = 100;

interface Dependencias {
  procesador: Pick<ProcesadorExportaciones, 'procesarPendientes'>;
  repositorio: Pick<ExportacionesRepository, 'expirar' | 'quitarArchivo'>;
  almacen: AlmacenArchivos;
  logger: Logger;
}

/**
 * A-24: los archivos vencidos (24 h). Primero la solicitud pasa a Expirada (ya no se descarga); después se borra
 * el archivo y se quita su referencia. Un borrado que falla vuelve a intentarse en la siguiente purga.
 */
async function purgar({
  repositorio,
  almacen,
  logger,
}: Omit<Dependencias, 'procesador'>): Promise<ResultadoTarea> {
  const archivos = await repositorio.expirar(MAXIMO_POR_PURGA);
  if (archivos === null) return null;
  let borrados = 0;
  for (const { idExportacion, referenciaArchivo } of archivos) {
    try {
      await almacen.borrar(referenciaArchivo);
      await repositorio.quitarArchivo(idExportacion);
      borrados += 1;
    } catch (error) {
      logger.warn(
        { err: error, idExportacion },
        'No se borró el archivo vencido; se reintenta en la próxima purga',
      );
    }
  }
  return { borrados, pendientes: archivos.length - borrados };
}

/**
 * A-04, A-24: las dos réplicas consumen la cola en competencia (sin sp_getapplock: la toma usa READPAST); la
 * purga, en cambio, la ejecuta una sola (sp_getapplock).
 */
export const tareasExportaciones = (dependencias: Dependencias): Tarea[] => [
  {
    nombre: 'Exportaciones.Procesar',
    intervaloMs: INTERVALO_COLA_MS,
    ejecutar: () => dependencias.procesador.procesarPendientes(),
  },
  {
    nombre: 'Exportaciones.Purgar',
    intervaloMs: UNA_HORA_MS,
    alIniciar: true,
    ejecutar: () => purgar(dependencias),
  },
];
