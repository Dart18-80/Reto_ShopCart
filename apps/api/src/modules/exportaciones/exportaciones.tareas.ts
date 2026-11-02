import type { Logger } from 'pino';
import type { AlmacenArchivos } from '../../shared/almacen/index.js';
import type { ResultadoTarea, Tarea } from '../../shared/jobs/index.js';
import type { Reloj } from '../../shared/reloj/index.js';
import type { ProcesadorExportaciones } from './exportaciones.procesador.js';
import type { ExportacionesRepository } from './exportaciones.repository.js';

// 01 §8: la cola se revisa seguido (el POST ya dispara el procesamiento; esto recoge lo demás).
const INTERVALO_COLA_MS = 10_000;
const UNA_HORA_MS = 3_600_000;
// Acota una ejecución de la purga; lo que quede lo borra la siguiente.
const MAXIMO_POR_PURGA = 100;
// Un archivo sin referencia en la base y con más de estas horas es huérfano (por ejemplo, la base falló al
// registrarlo): el barrido lo borra. Antes de eso podría estar a punto de registrarse.
export const HORAS_ANTIGUEDAD_HUERFANO = 24;
const MS_POR_HORA = 3_600_000;

const limiteDeHuerfano = (reloj: Reloj): Date =>
  new Date(reloj.ahora().getTime() - HORAS_ANTIGUEDAD_HUERFANO * MS_POR_HORA);

interface Dependencias {
  procesador: Pick<ProcesadorExportaciones, 'procesarPendientes'>;
  repositorio: Pick<ExportacionesRepository, 'expirar' | 'quitarArchivo' | 'referenciasExistentes'>;
  almacen: AlmacenArchivos;
  logger: Logger;
  reloj: Reloj;
}

/**
 * Decisión del PO (cierre de la Fase 1): borra los archivos del almacén que ninguna solicitud referencia y tienen
 * más de HORAS_ANTIGUEDAD_HUERFANO. Nunca uno referenciado, en ningún estado.
 */
async function barrerHuerfanos({
  repositorio,
  almacen,
  logger,
  reloj,
}: Omit<Dependencias, 'procesador'>): Promise<number> {
  const limite = limiteDeHuerfano(reloj);
  const viejos = (await almacen.listar())
    .filter((archivo) => archivo.modificado <= limite)
    .map((archivo) => archivo.nombre);
  if (viejos.length === 0) return 0;
  const referenciados = await repositorio.referenciasExistentes(viejos);
  const huerfanos = viejos.filter((nombre) => !referenciados.has(nombre));
  for (const nombre of huerfanos) await almacen.borrar(nombre);
  if (huerfanos.length > 0) {
    logger.warn(
      { huerfanos: huerfanos.length },
      'Se borraron archivos de exportación sin referencia',
    );
  }
  return huerfanos.length;
}

/** Decisión del PO (E9): los temporales que dejó una réplica que murió escribiendo, con el mismo plazo. */
async function barrerTemporales({
  almacen,
  logger,
  reloj,
}: Omit<Dependencias, 'procesador'>): Promise<number> {
  const temporales = await almacen.borrarTemporales(limiteDeHuerfano(reloj));
  if (temporales > 0)
    logger.warn({ temporales }, 'Se borraron exportaciones que quedaron a medias');
  return temporales;
}

/**
 * A-24: los archivos vencidos (24 h). Primero la solicitud pasa a Expirada (ya no se descarga); después se borra
 * el archivo y se quita su referencia. Un borrado que falla vuelve a intentarse en la siguiente purga.
 */
async function purgar(dependencias: Omit<Dependencias, 'procesador'>): Promise<ResultadoTarea> {
  const { repositorio, almacen, logger } = dependencias;
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
  const huerfanos = await barrerHuerfanos(dependencias);
  const temporales = await barrerTemporales(dependencias);
  return { borrados, pendientes: archivos.length - borrados, huerfanos, temporales };
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
