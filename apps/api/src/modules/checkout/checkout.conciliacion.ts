import type { Logger } from 'pino';
import type { ResultadoTarea } from '../../shared/jobs/index.js';
import { TIMEOUT_PASARELA_MS, type PasarelaPago } from '../../shared/pasarela/index.js';
import type { CheckoutRepository } from './checkout.repository.js';
import type { IntentoPorConciliar, ResolucionConciliada } from './checkout.types.js';

const MS_POR_SEGUNDO = 1000;
// 01 §6.2: solo se concilia lo que lleva más de 2 minutos con el arrendamiento vencido; antes, el
// reintento del cliente con la misma llave todavía lo puede retomar.
const SEGUNDOS_GRACIA = 120;
// La conciliación arrienda cada intento lo que tardan, como máximo, sus dos llamadas a la pasarela
// (consultar y capturar o anular), con holgura para las escrituras en la base: mientras tanto, un
// reintento del cliente recibe 409 y no puede crear el pedido de una autorización que se está anulando.
const MARGEN_CONCILIACION_MS = 40_000;
const SEGUNDOS_ARRENDAMIENTO_CONCILIACION =
  (2 * TIMEOUT_PASARELA_MS + MARGEN_CONCILIACION_MS) / MS_POR_SEGUNDO;
// Acota una ejecución; lo que quede lo toma la siguiente.
const MAX_INTENTOS_POR_EJECUCION = 50;

// SinCambio: otra petición ya había resuelto el intento (el compare-and-set no aplicó).
type EstadoConciliado = ResolucionConciliada['estado'] | 'SinCambio';

interface Dependencias {
  repositorio: Pick<CheckoutRepository, 'tomarIntentoPorConciliar' | 'resolverIntentoConciliado'>;
  pasarela: PasarelaPago;
  logger: Logger;
}

/**
 * N-03 (01 §6.2, E5-H04): resuelve los intentos de pago que una petición dejó en curso (la API murió, la
 * pasarela no respondió o falló la captura o la anulación). La pasarela es idempotente y la resolución
 * es un compare-and-set: correrla dos veces no cambia nada.
 */
export function crearConciliacionService({ repositorio, pasarela, logger }: Dependencias) {
  async function cerrar(
    intento: IntentoPorConciliar,
    resolucion: ResolucionConciliada,
  ): Promise<EstadoConciliado> {
    const resuelto = await repositorio.resolverIntentoConciliado(intento, resolucion);
    if (resuelto) return resolucion.estado;
    logger.warn(
      { idIntento: intento.idIntento, resolucion: resolucion.estado },
      'Otra petición ya había resuelto el intento; la conciliación no lo cambió',
    );
    return 'SinCambio';
  }

  // RF-06: se cobra solo lo que tiene pedido; sin pedido, la autorización se anula.
  async function capturarOAnular(
    intento: IntentoPorConciliar,
    idTransaccion: string,
  ): Promise<EstadoConciliado> {
    if (intento.idPedido !== null) {
      await pasarela.capturar(idTransaccion);
      return cerrar(intento, { estado: 'Capturado', idTransaccion });
    }
    await pasarela.anular(idTransaccion);
    return cerrar(intento, { estado: 'Anulado', idTransaccion });
  }

  async function resolverPendiente(intento: IntentoPorConciliar): Promise<EstadoConciliado> {
    const enPasarela = await pasarela.consultar(intento.llave);
    switch (enPasarela.estado) {
      case 'NoExiste':
        return cerrar(intento, { estado: 'Fallido' });
      case 'Rechazada':
        return cerrar(intento, {
          estado: 'Rechazado',
          codigo: enPasarela.codigo,
          mensaje: enPasarela.mensaje,
        });
      case 'Anulada':
        return cerrar(intento, { estado: 'Anulado', idTransaccion: enPasarela.idTransaccion });
      case 'Autorizada':
      case 'Capturada':
        return capturarOAnular(intento, enPasarela.idTransaccion);
    }
  }

  function resolver(intento: IntentoPorConciliar): Promise<EstadoConciliado> {
    if (intento.estado === 'Pendiente') return resolverPendiente(intento);
    if (intento.idTransaccion === null) {
      throw new Error(`El intento Autorizado ${String(intento.idIntento)} no tiene transacción`);
    }
    return capturarOAnular(intento, intento.idTransaccion);
  }

  return {
    async conciliar(): Promise<ResultadoTarea> {
      const resumen: Record<EstadoConciliado | 'errores', number> = {
        Fallido: 0,
        Rechazado: 0,
        Anulado: 0,
        Capturado: 0,
        SinCambio: 0,
        errores: 0,
      };
      for (let tomados = 0; tomados < MAX_INTENTOS_POR_EJECUCION; tomados++) {
        const toma = await repositorio.tomarIntentoPorConciliar(
          SEGUNDOS_GRACIA,
          SEGUNDOS_ARRENDAMIENTO_CONCILIACION,
        );
        if (!toma.ejecutada) return tomados === 0 ? null : resumen;
        if (toma.intento === null) break;
        try {
          resumen[await resolver(toma.intento)] += 1;
        } catch (error) {
          // El intento sigue en curso: la siguiente ejecución lo vuelve a tomar al vencer su arrendamiento.
          resumen.errores += 1;
          logger.error(
            { err: error, idIntento: toma.intento.idIntento },
            'No se pudo conciliar el intento de pago',
          );
        }
      }
      return resumen;
    },
  };
}

export type ConciliacionService = ReturnType<typeof crearConciliacionService>;
