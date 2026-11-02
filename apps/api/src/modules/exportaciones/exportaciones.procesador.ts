import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type { Logger } from 'pino';
import type { AlmacenArchivos } from '../../shared/almacen/index.js';
import { ejecutarConContexto, fueraDeLaPeticion } from '../../shared/http/index.js';
import type { Reloj } from '../../shared/reloj/index.js';
import type { ReportesService } from '../reportes/index.js';
import { GENERADORES } from './exportaciones.generadores.js';
import type { ExportacionesRepository } from './exportaciones.repository.js';
import { TABLAS } from './exportaciones.tablas.js';
import type { ExportacionTomada } from './exportaciones.types.js';

// A-24: cada réplica genera como mucho dos archivos a la vez; el resto espera en la cola (la otra réplica o el
// siguiente ciclo los toma). Es un límite local de la réplica, no un estado compartido (RNF-2).
export const CONCURRENCIA_MAXIMA_POR_REPLICA = 2;
// Lo que tarda como máximo generar un reporte con el límite de filas, con holgura. Si la réplica muere, otra la
// retoma al vencer.
export const SEGUNDOS_ARRENDAMIENTO_EXPORTACION = 120;
export const MAX_INTENTOS_EXPORTACION = 3;
export const HORAS_VIGENCIA_ARCHIVO = 24;
const MENSAJE_REINTENTO = 'No se pudo generar el archivo; se volverá a intentar.';

/** Un error que reintentar no arregla (por ejemplo, el reporte pasa el límite de filas del formato). */
export class ExportacionImposible extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ExportacionImposible';
  }
}

type Resultado = 'completadas' | 'reintentos' | 'fallidas' | 'desplazadas' | 'errores';

interface Dependencias {
  repositorio: Pick<ExportacionesRepository, 'tomar' | 'completar' | 'registrarFallo'>;
  reportes: ReportesService;
  almacen: AlmacenArchivos;
  logger: Logger;
  reloj: Reloj;
}

/**
 * A-24 (E7-H05): consumidor de la cola de exportaciones. Toma con arrendamiento y token (fencing), genera el
 * archivo por streaming y lo guarda en el almacén compartido, y completa con compare-and-set del token.
 */
export function crearProcesadorExportaciones({
  repositorio,
  reportes,
  almacen,
  logger,
  reloj,
}: Dependencias) {
  let enCurso = 0;

  async function generar(tomada: ExportacionTomada) {
    const generador = GENERADORES[tomada.formato];
    const definicion = TABLAS[tomada.reporte];
    // SP_Dashboard_* es solo para el Admin: el reporte se lee en nombre del Administrador que lo pidió.
    const tabla = await ejecutarConContexto(
      { requestId: randomUUID(), idUsuario: tomada.idUsuario, rol: 'Administrador' },
      () => definicion.construir(reportes, tomada.filtros, generador.limiteFilas),
    );
    if (tabla.filas.length > generador.limiteFilas) {
      throw new ExportacionImposible(
        `El reporte tiene más de ${String(generador.limiteFilas)} filas, el máximo para ${tomada.formato}. ` +
          'Acota el rango de fechas o usa Excel.',
      );
    }
    // El nombre lo genera el servidor; el ID lo agrupa y el UUID evita choques entre réplicas.
    const referencia = `${String(tomada.idExportacion)}-${randomUUID()}.${tomada.formato}`;
    const destino = new PassThrough();
    const [, { tamanoBytes }] = await Promise.all([
      generador.escribir(tabla, reloj.ahora(), destino).catch((error: unknown) => {
        destino.destroy(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }),
      almacen.guardar(referencia, destino),
    ]);
    return { referencia, tamanoBytes };
  }

  async function fallar(tomada: ExportacionTomada, error: unknown): Promise<Resultado> {
    const definitivo = error instanceof ExportacionImposible;
    logger.error(
      { err: error, idExportacion: tomada.idExportacion, intento: tomada.intentos },
      'No se generó el archivo de la exportación',
    );
    const { estado } = await repositorio.registrarFallo(
      tomada,
      definitivo ? error.message : MENSAJE_REINTENTO,
      definitivo,
      MAX_INTENTOS_EXPORTACION,
    );
    return estado === 'Fallida' ? 'fallidas' : 'reintentos';
  }

  async function procesar(tomada: ExportacionTomada): Promise<Resultado> {
    let archivo: { referencia: string; tamanoBytes: number };
    try {
      archivo = await generar(tomada);
    } catch (error) {
      return fallar(tomada, error);
    }
    const completada = await repositorio.completar(
      tomada,
      archivo.referencia,
      archivo.tamanoBytes,
      HORAS_VIGENCIA_ARCHIVO,
    );
    if (completada) return 'completadas';
    // Fencing: otra réplica la retomó (el arrendamiento de esta venció). Este archivo sobra: queda uno solo.
    await almacen.borrar(archivo.referencia);
    logger.warn(
      { idExportacion: tomada.idExportacion },
      'Otra réplica retomó la exportación; se descarta el archivo de esta',
    );
    return 'desplazadas';
  }

  async function tomar(): Promise<ExportacionTomada | null> {
    try {
      return await repositorio.tomar(SEGUNDOS_ARRENDAMIENTO_EXPORTACION, MAX_INTENTOS_EXPORTACION);
    } catch (error) {
      enCurso -= 1;
      throw error;
    }
  }

  return {
    /**
     * Toma exportaciones hasta llenar la concurrencia de esta réplica y espera a que terminen. Corre fuera de la
     * petición (rol Sistema), aunque la dispare un POST.
     */
    procesarPendientes(): Promise<Record<Resultado, number>> {
      return fueraDeLaPeticion(async () => {
        const resumen: Record<Resultado, number> = {
          completadas: 0,
          reintentos: 0,
          fallidas: 0,
          desplazadas: 0,
          errores: 0,
        };
        const enProceso: Promise<void>[] = [];
        while (enCurso < CONCURRENCIA_MAXIMA_POR_REPLICA) {
          // El lugar se reserva antes de tomar: dos llamadas a la vez (el POST y la tarea) no lo pasan.
          enCurso += 1;
          const tomada = await tomar();
          if (tomada === null) {
            enCurso -= 1;
            break;
          }
          enProceso.push(
            procesar(tomada)
              .then((resultado) => {
                resumen[resultado] += 1;
              })
              .catch((error: unknown) => {
                // La base falló al registrar: queda Procesando y se retoma al vencer su arrendamiento.
                resumen.errores += 1;
                logger.error(
                  { err: error, idExportacion: tomada.idExportacion },
                  'No se registró el resultado de la exportación',
                );
              })
              .finally(() => {
                enCurso -= 1;
              }),
          );
        }
        await Promise.all(enProceso);
        return resumen;
      });
    },
  };
}

export type ProcesadorExportaciones = ReturnType<typeof crearProcesadorExportaciones>;
