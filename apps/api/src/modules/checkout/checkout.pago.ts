import { setTimeout as dormir } from 'node:timers/promises';
import type { Decimal } from 'decimal.js';
import type { Logger } from 'pino';
import { AppError, esCodigoError } from '../../shared/errors/index.js';
import {
  marcaDeTarjeta,
  PasarelaSinRespuesta,
  TIMEOUT_PASARELA_MS,
  ultimosDigitos,
  type PasarelaPago,
  type ResultadoAutorizacion,
  type TarjetaPago,
} from '../../shared/pasarela/index.js';
import type { Pedido, PedidosParaCheckout } from '../pedidos/index.js';
import type { CheckoutRepository } from './checkout.repository.js';
import type { PagoRealizado } from './checkout.types.js';

// N-03: el arrendamiento cubre el timeout de la pasarela más un margen para crear el pedido y capturar.
export const MARGEN_ARRENDAMIENTO_MS = 5_000;
const MS_POR_SEGUNDO = 1000;
const SEGUNDOS_ARRENDAMIENTO = (TIMEOUT_PASARELA_MS + MARGEN_ARRENDAMIENTO_MS) / MS_POR_SEGUNDO;
// Si la anulación falla, se reintenta en la misma petición antes de dejarla a la conciliación.
const INTENTOS_ANULACION = 3;
const ESPERA_BASE_ANULACION_MS = 100;

interface Dependencias {
  repositorio: Pick<
    CheckoutRepository,
    'registrarIntento' | 'actualizarIntento' | 'liberarArrendamiento'
  >;
  pedidos: PedidosParaCheckout;
  pasarela: PasarelaPago;
  logger: Logger;
  /** Espera entre los intentos de anulación (las pruebas la reemplazan). */
  esperar?: (ms: number) => Promise<unknown>;
}

export interface SolicitudPago {
  llave: string;
  tarjeta: TarjetaPago;
}

/**
 * RF-06, N-03 (01 §6.2): registrar el intento (candado de idempotencia y arrendamiento) → autorizar →
 * crear el pedido (transacción atómica) → capturar, o anular si el pedido no se creó. Ninguna llamada a
 * la pasarela ocurre dentro de una transacción: cada SP ya hizo COMMIT antes.
 */
export function crearPagoService({
  repositorio,
  pedidos,
  pasarela,
  logger,
  esperar = dormir,
}: Dependencias) {
  async function obtenerPedido(idPedido: number): Promise<Pedido> {
    const pedido = await pedidos.obtener(idPedido);
    if (pedido === null) throw new Error(`El pedido ${String(idPedido)} del pago no existe`);
    return pedido;
  }

  async function capturar(idIntento: number, idTransaccion: string): Promise<void> {
    try {
      await pasarela.capturar(idTransaccion);
    } catch (error) {
      // El pedido ya existe y el cobro está autorizado: la conciliación (E5-H04) captura después.
      logger.warn(
        { err: error, idIntento, idTransaccion },
        'La pasarela no capturó el pago; queda para la conciliación',
      );
      return;
    }
    try {
      await repositorio.actualizarIntento(idIntento, { estado: 'Capturado' });
    } catch (error) {
      logger.warn(
        { err: error, idIntento, idTransaccion },
        'El pago se capturó pero el intento no se actualizó; la conciliación lo cierra',
      );
    }
  }

  async function anular(idIntento: number, idTransaccion: string, causa: unknown): Promise<void> {
    const codigo = causa instanceof AppError ? causa.codigo : 'ERROR_INTERNO';
    for (let intento = 1; intento <= INTENTOS_ANULACION; intento++) {
      try {
        await pasarela.anular(idTransaccion);
        await repositorio.actualizarIntento(idIntento, {
          estado: 'Anulado',
          codigo,
          mensaje: causa instanceof AppError ? causa.message : null,
        });
        logger.info(
          { idIntento, idTransaccion, codigo },
          'Autorización anulada: el pedido no se creó',
        );
        return;
      } catch (error) {
        logger.warn({ err: error, idIntento, idTransaccion, intento }, 'La anulación falló');
        if (intento === INTENTOS_ANULACION) {
          // Queda Autorizado sin pedido: la conciliación lo anula.
          logger.error({ idIntento, idTransaccion }, 'No se pudo anular la autorización del pago');
          return;
        }
        await esperar(ESPERA_BASE_ANULACION_MS * intento);
      }
    }
  }

  /**
   * SP_Pedidos_CrearPedido falló, pero pudo hacerlo después de su COMMIT (por ejemplo, un timeout al
   * devolver el detalle). Solo se anula si la base confirma que no hay pedido (RF-06: sin pedido no hay
   * cobro, y con pedido el cobro no se anula).
   */
  async function pedidoTrasFalla(
    causa: unknown,
    idIntento: number,
    idTransaccion: string,
  ): Promise<Pedido> {
    let pedido: Pedido | null;
    try {
      pedido = await pedidos.obtenerDeIntento(idIntento);
    } catch (error) {
      // Sin saber si el pedido existe no se toca el cobro: la conciliación decide bajo bloqueo.
      logger.error(
        { err: error, causa, idIntento },
        'No se pudo comprobar el pedido tras la falla; el intento queda para la conciliación',
      );
      throw causa;
    }
    if (pedido === null) {
      await anular(idIntento, idTransaccion, causa);
      throw causa;
    }
    logger.warn(
      { err: causa, idIntento, idPedido: pedido.idPedido },
      'El pedido se confirmó aunque la petición falló; se continúa con la captura',
    );
    return pedido;
  }

  async function crearPedidoYCapturar(
    idIntento: number,
    idTransaccion: string,
  ): Promise<PagoRealizado> {
    let pedido: Pedido;
    try {
      pedido = await pedidos.crearDeIntento(idIntento);
    } catch (error) {
      pedido = await pedidoTrasFalla(error, idIntento, idTransaccion);
    }
    await capturar(idIntento, idTransaccion);
    return { pedido, creado: true };
  }

  // N-03: un timeout libera el arrendamiento para que el reintento con la misma llave no espere.
  async function liberarTrasFalla(idIntento: number, causa: unknown): Promise<never> {
    if (causa instanceof PasarelaSinRespuesta) {
      logger.warn({ err: causa, idIntento }, 'La pasarela no respondió al autorizar');
    } else {
      logger.error({ err: causa, idIntento }, 'Error inesperado al autorizar en la pasarela');
    }
    try {
      await repositorio.liberarArrendamiento(idIntento);
    } catch (error) {
      logger.error({ err: error, idIntento }, 'No se liberó el arrendamiento; vence solo');
    }
    throw new AppError('PAGO_SIN_CONFIRMAR', { cause: causa });
  }

  async function autorizar(
    idIntento: number,
    monto: Decimal,
    { llave, tarjeta }: SolicitudPago,
  ): Promise<PagoRealizado> {
    let resultado: ResultadoAutorizacion;
    try {
      resultado = await pasarela.autorizar({ llave, monto, tarjeta });
    } catch (error) {
      return liberarTrasFalla(idIntento, error);
    }

    if (resultado.tipo === 'Rechazada') {
      const { intentosRestantes, sesionCancelada } = await repositorio.actualizarIntento(
        idIntento,
        {
          estado: 'Rechazado',
          codigo: resultado.codigo,
          mensaje: resultado.mensaje,
        },
      );
      throw rechazo(resultado.mensaje, intentosRestantes, sesionCancelada);
    }

    await repositorio.actualizarIntento(idIntento, {
      estado: 'Autorizado',
      idTransaccion: resultado.idTransaccion,
    });
    return crearPedidoYCapturar(idIntento, resultado.idTransaccion);
  }

  return {
    async pagar(solicitud: SolicitudPago): Promise<PagoRealizado> {
      const registro = await repositorio.registrarIntento({
        llave: solicitud.llave,
        marca: marcaDeTarjeta(solicitud.tarjeta.numero),
        ultimosDigitos: ultimosDigitos(solicitud.tarjeta.numero),
        segundosArrendamiento: SEGUNDOS_ARRENDAMIENTO,
      });

      switch (registro.accion) {
        case 'Autorizar':
          return autorizar(registro.idIntento, registro.monto, solicitud);
        case 'CrearPedido':
          return crearPedidoYCapturar(registro.idIntento, registro.idTransaccion);
        case 'Capturar':
          await capturar(registro.idIntento, registro.idTransaccion);
          return { pedido: await obtenerPedido(registro.idPedido), creado: false };
        case 'Pedido':
          return { pedido: await obtenerPedido(registro.idPedido), creado: false };
        case 'EnCurso':
          throw new AppError('PAGO_EN_CURSO', {
            mensaje:
              'Tu pago se está procesando. Espera un momento y reintenta con la misma llave.',
            segundosParaReintentar: registro.segundosParaReintentar,
          });
        case 'Rechazado':
          throw rechazo(
            registro.mensaje,
            registro.intentosRestantes,
            registro.intentosRestantes <= 0,
          );
        case 'Error':
          throw new AppError(esCodigoError(registro.codigo) ? registro.codigo : 'ERROR_INTERNO', {
            mensaje: registro.mensaje ?? undefined,
          });
      }
    },
  };
}

function rechazo(mensaje: string, intentosRestantes: number, sesionCancelada: boolean): AppError {
  return new AppError('PAGO_RECHAZADO', {
    mensaje: sesionCancelada
      ? `${mensaje} Se canceló tu pago por demasiados intentos: vuelve a iniciarlo.`
      : mensaje,
    detalles: { intentosRestantes, sesionCancelada },
  });
}

export type PagoService = ReturnType<typeof crearPagoService>;
