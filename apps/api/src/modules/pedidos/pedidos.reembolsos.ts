import type { Logger } from 'pino';
import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import type { ResultadoTarea } from '../../shared/jobs/index.js';
import {
  PasarelaSinRespuesta,
  TIMEOUT_PASARELA_MS,
  type PasarelaPago,
} from '../../shared/pasarela/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { PedidosRepository } from './pedidos.repository.js';
import type { ListarReembolsos, RegistrarDevolucion } from './pedidos.schemas.js';
import type {
  Cancelacion,
  DevolucionRegistrada,
  EstadoReembolso,
  Reembolso,
  ReembolsoParaProcesar,
  ResultadoActualizacionReembolso,
  ResultadoReembolso,
} from './pedidos.types.js';

// N-09: hasta 5 intentos, uno cada 5 minutos; después Fallido y a la lista del Admin.
const MAX_INTENTOS = 5;
const SEGUNDOS_ENTRE_INTENTOS = 5 * 60;
const MS_POR_SEGUNDO = 1000;
// Mientras se procesa, el reembolso queda tomado lo que tardan sus dos llamadas a la pasarela, con holgura.
const MARGEN_RECLAMO_MS = 40_000;
const SEGUNDOS_RECLAMO = (2 * TIMEOUT_PASARELA_MS + MARGEN_RECLAMO_MS) / MS_POR_SEGUNDO;
// Acota una ejecución del job; lo que quede lo toma la siguiente.
const LOTE_JOB = 50;

interface Dependencias {
  repositorio: Pick<
    PedidosRepository,
    | 'cancelar'
    | 'registrarDevolucion'
    | 'obtener'
    | 'tomarReembolso'
    | 'actualizarReembolso'
    | 'obtenerReembolsosPendientes'
    | 'listarReembolsos'
    | 'reintentarReembolso'
  >;
  pasarela: PasarelaPago;
  logger: Logger;
  /** A-11: cancelar y devolver cambian las ventas de los reportes. */
  reportes: InvalidadorReportes;
}

/**
 * N-09, N-10 (plan E6-H03 §3): devolver el dinero ocurre después del COMMIT de la cancelación o la
 * devolución, nunca dentro de su transacción. La llave del reembolso es fija, así la petición, el Admin y
 * el job nunca reembolsan dos veces.
 */
export function crearReembolsosService({ repositorio, pasarela, logger, reportes }: Dependencias) {
  /**
   * Una cancelación devuelve según lo que la pasarela tiene: una autorización sin capturar se anula y una
   * captura se reembolsa. Cubre la carrera en la que el cobro se capturó justo antes de cancelar.
   */
  async function devolverCancelacion(reembolso: ReembolsoParaProcesar): Promise<string | null> {
    const enPasarela = await pasarela.consultar(reembolso.llaveIntento);
    switch (enPasarela.estado) {
      case 'Autorizada':
        await pasarela.anular(enPasarela.idTransaccion);
        return null;
      case 'Anulada':
        return null;
      case 'Capturada':
        return reembolsar(reembolso, enPasarela.idTransaccion);
      case 'NoExiste':
      case 'Rechazada':
        throw new Error(
          `El cobro del reembolso ${String(reembolso.idReembolso)} no existe en la pasarela`,
        );
    }
  }

  async function reembolsar(reembolso: ReembolsoParaProcesar, idTransaccion: string) {
    const { idReembolso } = await pasarela.reembolsar({
      llave: reembolso.llave,
      idTransaccion,
      monto: reembolso.monto,
    });
    return idReembolso;
  }

  async function devolver(reembolso: ReembolsoParaProcesar): Promise<ResultadoReembolso> {
    try {
      if (reembolso.origen === 'Cancelacion') {
        return { exito: true, idTransaccionReembolso: await devolverCancelacion(reembolso) };
      }
      if (reembolso.idTransaccion === null) {
        throw new Error(
          `El pedido del reembolso ${String(reembolso.idReembolso)} no tiene transacción`,
        );
      }
      return {
        exito: true,
        idTransaccionReembolso: await reembolsar(reembolso, reembolso.idTransaccion),
      };
    } catch (error) {
      // Un timeout es transitorio; cualquier otro error (cobro inexistente, llave rechazada, un bug) se
      // registra como error desde el primer intento.
      const nivel = error instanceof PasarelaSinRespuesta ? 'warn' : 'error';
      logger[nivel](
        { err: error, idReembolso: reembolso.idReembolso },
        'No se devolvió el dinero del reembolso; queda para reintentar',
      );
      return { exito: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }

  /**
   * Si la base falla después de que la pasarela devolvió el dinero, la transacción del reembolso queda en el
   * log antes de relanzar (quien llama registra la falla); la llave fija evita devolver dos veces cuando el
   * job lo reintente.
   */
  async function registrarResultado(
    reembolso: ReembolsoParaProcesar,
    resultado: ResultadoReembolso,
  ): Promise<ResultadoActualizacionReembolso> {
    const { idReembolso } = reembolso;
    let registro: ResultadoActualizacionReembolso;
    try {
      registro = await repositorio.actualizarReembolso(reembolso, resultado, {
        maxIntentos: MAX_INTENTOS,
        segundosEntreIntentos: SEGUNDOS_ENTRE_INTENTOS,
      });
    } catch (error) {
      if (resultado.exito) {
        logger.error(
          { idReembolso, idTransaccionReembolso: resultado.idTransaccionReembolso },
          'La pasarela devolvió el dinero pero no se registró; el job lo completa con la misma llave',
        );
      }
      throw error;
    }
    if (!registro.aplicado && !resultado.exito) {
      logger.warn(
        { idReembolso, error: resultado.error, estado: registro.estado },
        'Reclamo desplazado: otro proceso tomó el reembolso y este fallo no se registró',
      );
    }
    return registro;
  }

  /** null si no estaba Pendiente o ya lo procesaba otro (no se toca). */
  async function procesar(idReembolso: number): Promise<EstadoReembolso | null> {
    const reembolso = await repositorio.tomarReembolso(idReembolso, SEGUNDOS_RECLAMO);
    if (reembolso === null) return null;
    const resultado = await devolver(reembolso);
    const { estado, aplicado } = await registrarResultado(reembolso, resultado);
    if (resultado.exito && estado !== 'Completado') {
      logger.error(
        { idReembolso, idTransaccionReembolso: resultado.idTransaccionReembolso, estado },
        'La pasarela devolvió el dinero pero el reembolso no quedó Completado',
      );
    } else if (aplicado && estado === 'Fallido') {
      logger.error(
        { idReembolso },
        'Reembolso Fallido tras 5 intentos: requiere resolución manual',
      );
    }
    return estado;
  }

  /**
   * La cancelación o la devolución ya se confirmaron: cualquier falla al devolver el dinero (de la pasarela
   * o de la base) deja el reembolso Pendiente para el job, y la respuesta refleja lo confirmado.
   */
  async function procesarTrasConfirmar(
    idReembolso: number,
    contexto: Record<string, number>,
  ): Promise<EstadoReembolso> {
    try {
      return (await procesar(idReembolso)) ?? 'Pendiente';
    } catch (error) {
      logger.error(
        { err: error, idReembolso, ...contexto },
        'Operación confirmada; su reembolso queda Pendiente para el job',
      );
      return 'Pendiente';
    }
  }

  return {
    procesar,

    async cancelar(idPedido: number, motivo: string): Promise<Cancelacion> {
      const idReembolso = await reportes.tras(repositorio.cancelar(idPedido, motivo));
      const estado = await procesarTrasConfirmar(idReembolso, { idPedido });
      const pedido = await repositorio.obtener(idPedido);
      if (pedido === null) throw new Error(`El pedido ${String(idPedido)} cancelado no existe`);
      return { pedido, reembolso: { idReembolso, estado } };
    },

    async registrarDevolucion(
      idPedido: number,
      datos: RegistrarDevolucion,
    ): Promise<DevolucionRegistrada> {
      const { idDevolucion, idReembolso, montoReembolso } = await reportes.tras(
        repositorio.registrarDevolucion(idPedido, datos),
      );
      const estado = await procesarTrasConfirmar(idReembolso, { idPedido, idDevolucion });
      const pedido = await repositorio.obtener(idPedido);
      if (pedido === null) throw new Error(`El pedido ${String(idPedido)} devuelto no existe`);
      return {
        pedido,
        devolucion: { idDevolucion, montoReembolso },
        reembolso: { idReembolso, estado },
      };
    },

    listar: (filtros: ListarReembolsos): Promise<PaginaSP<Reembolso>> =>
      repositorio.listarReembolsos(filtros),

    async reintentar(idReembolso: number): Promise<EstadoReembolso> {
      const estado = await repositorio.reintentarReembolso(idReembolso);
      if (estado === null)
        throw new AppError('NO_ENCONTRADO', { mensaje: 'El reembolso no existe.' });
      if (estado === 'Completado') return estado;
      return (await procesar(idReembolso)) ?? estado;
    },

    /** Job (A-04): cada 5 minutos. null si la otra réplica tenía el sp_getapplock. */
    async reintentarPendientes(): Promise<ResultadoTarea> {
      const ids = await repositorio.obtenerReembolsosPendientes(LOTE_JOB);
      if (ids === null) return null;
      const resumen: Record<EstadoReembolso | 'errores', number> = {
        Pendiente: 0,
        Completado: 0,
        Fallido: 0,
        errores: 0,
      };
      for (const idReembolso of ids) {
        try {
          // null: la otra réplica lo tomó entre el listado y este turno.
          const estado = await procesar(idReembolso);
          if (estado !== null) resumen[estado] += 1;
        } catch (error) {
          resumen.errores += 1;
          logger.error({ err: error, idReembolso }, 'No se pudo procesar el reembolso');
        }
      }
      return resumen;
    },
  };
}

export type ReembolsosService = ReturnType<typeof crearReembolsosService>;
