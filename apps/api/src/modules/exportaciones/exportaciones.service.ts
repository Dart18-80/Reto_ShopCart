import type { Logger } from 'pino';
import { ArchivoNoEncontrado, type AlmacenArchivos } from '../../shared/almacen/index.js';
import type { PaginaSP } from '../../shared/db/index.js';
import type { Reloj } from '../../shared/reloj/index.js';
import { AppError } from '../../shared/errors/index.js';
import { hashDeFiltros, normalizarFiltros } from '../reportes/index.js';
import { sufijoDeFecha } from './exportaciones.formato.js';
import { GENERADORES } from './exportaciones.generadores.js';
import type { ProcesadorExportaciones } from './exportaciones.procesador.js';
import type { ExportacionesRepository } from './exportaciones.repository.js';
import type { ListarExportaciones, SolicitarExportacion } from './exportaciones.schemas.js';
import { TABLAS } from './exportaciones.tablas.js';
import type {
  ArchivoExportado,
  Exportacion,
  ExportacionSolicitada,
  ReporteExportable,
} from './exportaciones.types.js';

// A-24: cuántas exportaciones puede tener en curso (Pendiente o Procesando) un mismo Administrador.
export const MAX_EXPORTACIONES_PENDIENTES = 3;

interface Dependencias {
  repositorio: Pick<ExportacionesRepository, 'solicitar' | 'obtener' | 'listar'>;
  almacen: Pick<AlmacenArchivos, 'leer'>;
  procesador: Pick<ProcesadorExportaciones, 'procesarPendientes'>;
  logger: Logger;
  reloj: Reloj;
}

/** E7-H05 (A-24): exportación asíncrona de los reportes del dashboard. */
export function crearExportacionesService({
  repositorio,
  almacen,
  procesador,
  logger,
  reloj,
}: Dependencias) {
  async function propia(idExportacion: number): Promise<Exportacion> {
    const exportacion = await repositorio.obtener(idExportacion);
    // RF-01: la de otro Administrador responde igual que una inexistente.
    if (exportacion === null)
      throw new AppError('NO_ENCONTRADO', { mensaje: 'La exportación no existe.' });
    return exportacion;
  }

  return {
    async solicitar(
      reporte: ReporteExportable,
      { formato, filtros }: SolicitarExportacion,
    ): Promise<ExportacionSolicitada> {
      // Los filtros se validan con el esquema del mismo reporte del dashboard.
      const leidos = TABLAS[reporte].filtros.safeParse(filtros);
      if (!leidos.success) {
        const errores = leidos.error.issues.map((problema) => ({
          campo: ['body', 'filtros', ...problema.path].join('.'),
          mensaje: problema.message,
        }));
        throw new AppError('VALIDACION_FALLIDA', { detalles: { errores } });
      }
      const normalizados = normalizarFiltros(leidos.data);
      const solicitud = await repositorio.solicitar(
        reporte,
        formato,
        JSON.stringify(normalizados),
        Buffer.from(hashDeFiltros(normalizados), 'hex'),
        MAX_EXPORTACIONES_PENDIENTES,
      );
      if (solicitud.nueva) {
        // A-24: la réplica que recibió la solicitud la procesa de inmediato, sin esperar el siguiente ciclo.
        void procesador.procesarPendientes().catch((error: unknown) => {
          logger.error({ err: error }, 'No se pudo procesar la cola de exportaciones');
        });
      }
      return solicitud;
    },

    obtener: propia,

    listar: ({ pagina, tamano }: ListarExportaciones): Promise<PaginaSP<Exportacion>> =>
      repositorio.listar(pagina, tamano),

    async archivo(idExportacion: number): Promise<ArchivoExportado> {
      const {
        estado,
        reporte,
        formato,
        referenciaArchivo,
        tamanoBytes,
        fechaFinalizacion,
        fechaExpiracion,
      } = await propia(idExportacion);
      // Vencida aunque la purga horaria todavía no la haya marcado Expirada.
      const vencida = fechaExpiracion !== null && fechaExpiracion <= reloj.ahora();
      if (estado === 'Expirada' || (estado === 'Completada' && vencida)) {
        throw new AppError('EXPORTACION_EXPIRADA');
      }
      if (
        estado !== 'Completada' ||
        referenciaArchivo === null ||
        tamanoBytes === null ||
        fechaFinalizacion === null
      ) {
        throw new AppError('EXPORTACION_NO_LISTA');
      }
      try {
        return {
          contenido: await almacen.leer(referenciaArchivo),
          // El nombre lo arma el servidor: el reporte y la fecha local en que se generó.
          nombreDescarga: `${reporte}_${sufijoDeFecha(fechaFinalizacion)}.${formato}`,
          tipoContenido: GENERADORES[formato].tipoContenido,
          tamanoBytes,
        };
      } catch (error) {
        if (!(error instanceof ArchivoNoEncontrado)) throw error;
        logger.error(
          { err: error, idExportacion },
          'Exportación Completada sin su archivo en el almacén',
        );
        throw new AppError('EXPORTACION_EXPIRADA');
      }
    },
  };
}

export type ExportacionesService = ReturnType<typeof crearExportacionesService>;
