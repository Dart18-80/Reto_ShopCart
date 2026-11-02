import { setTimeout as esperar } from 'node:timers/promises';
import type { Decimal } from 'decimal.js';
import type { Logger } from 'pino';
import { AppError, esCodigoError } from '../../shared/errors/index.js';
import {
  marcaDeTarjeta,
  ultimosDigitos,
  type PasarelaPago,
  type TarjetaPago,
} from '../../shared/pasarela/index.js';
import type { Pedido, PedidosParaCheckout } from '../pedidos/index.js';
import type { CheckoutRepository } from './checkout.repository.js';
import type { PagoRealizado } from './checkout.types.js';

// N-03: el arrendamiento cubre el timeout de la pasarela más un margen para crear el pedido y capturar.
export const TIMEOUT_PASARELA_MS = 10_000;
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
}

export interface SolicitudPago {
  llave: string;
  tarjeta: TarjetaPago;
}

/**
 * RF-06, N-03 (01 §6.2): registrar el intento (candado de idempotencia y arrendamiento) → autorizar →
 * crear el pedido (transacción atómica) → capturar, o anular si el pedido falla. Ninguna llamada a la
 * pasarela ocurre dentro de una transacción: cada SP ya hizo COMMIT antes.
 */
export function crearPagoService({ repositorio, pedidos, pasarela, logger }: Dependencias) {
  async function obtenerPedido(idPedido: number): Promise<Pedido> {
    const pedido = await pedidos.obtener(idPedido);
    if (pedido === null) throw new Error(`El pedido ${String(idPedido)} del pago no existe`);
    return pedido;
  }

  async function capturar(idIntento: number, idTransaccion: string): Promise<void> {
    try {
      await pasarela.capturar(idTransaccion);
      await repositorio.actualizarIntento(idIntento, { estado: 'Capturado' });
    } catch (error) {
      // El pedido ya existe y el cobro está autorizado: la conciliación (E5-H04) captura después.
      logger.warn(
        { err: error, idIntento },
        'No se pudo capturar el pago; queda para la conciliación',
      );
    }
  }

  async function anular(idIntento: number, idTransaccion: string, causa: unknown): Promise<void> {
    for (let intento = 1; intento <= INTENTOS_ANULACION; intento++) {
      try {
        await pasarela.anular(idTransaccion);
        const codigo = causa instanceof AppError ? causa.codigo : 'ERROR_INTERNO';
        await repositorio.actualizarIntento(idIntento, {
          estado: 'Anulado',
          codigo,
          mensaje: causa instanceof AppError ? causa.message : null,
        });
        return;
      } catch (error) {
        if (intento === INTENTOS_ANULACION) {
          // Queda Autorizado sin pedido: la conciliación lo anula.
          logger.error({ err: error, idIntento }, 'No se pudo anular la autorización del pago');
          return;
        }
        await esperar(ESPERA_BASE_ANULACION_MS * intento);
      }
    }
  }

  async function crearPedidoYCapturar(
    idIntento: number,
    idTransaccion: string,
  ): Promise<PagoRealizado> {
    let pedido: Pedido;
    try {
      pedido = await pedidos.crearDeIntento(idIntento);
    } catch (error) {
      // RF-06: sin pedido no hay cobro.
      await anular(idIntento, idTransaccion, error);
      throw error;
    }
    await capturar(idIntento, idTransaccion);
    return { pedido, creado: true };
  }

  async function autorizar(
    idIntento: number,
    monto: Decimal,
    { llave, tarjeta }: SolicitudPago,
  ): Promise<PagoRealizado> {
    let resultado;
    try {
      resultado = await pasarela.autorizar({ llave, monto, tarjeta });
    } catch (error) {
      // N-03: no se sabe si autorizó. Se libera el arrendamiento y el reintento con la misma llave lo resuelve.
      await repositorio.liberarArrendamiento(idIntento);
      logger.warn({ err: error, idIntento }, 'La pasarela no respondió al autorizar');
      throw new AppError('PAGO_SIN_CONFIRMAR', { cause: error });
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
