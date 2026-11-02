import { setTimeout as dormir } from 'node:timers/promises';
import type { Decimal } from 'decimal.js';
import type { Logger } from 'pino';
import { AppError, esCodigoError } from '../../shared/errors/index.js';
import {
  marcaDeTarjeta,
  PasarelaSinRespuesta,
  TIMEOUT_PASARELA_MS,
  ultimosDigitos,
  type EstadoEnPasarela,
  type PasarelaPago,
  type ResultadoAutorizacion,
  type TarjetaPago,
} from '../../shared/pasarela/index.js';
import type { Pedido, PedidosParaCheckout } from '../pedidos/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { CheckoutRepository } from './checkout.repository.js';
import type { Arrendamiento, CambioIntento, PagoRealizado } from './checkout.types.js';

// N-03: el arrendamiento cubre el timeout de la pasarela más un margen para crear el pedido y capturar.
export const MARGEN_ARRENDAMIENTO_MS = 5_000;
const MS_POR_SEGUNDO = 1000;
const SEGUNDOS_ARRENDAMIENTO = (TIMEOUT_PASARELA_MS + MARGEN_ARRENDAMIENTO_MS) / MS_POR_SEGUNDO;
// Si la anulación falla, se reintenta en la misma petición antes de dejarla a la conciliación.
const INTENTOS_ANULACION = 3;
const ESPERA_BASE_ANULACION_MS = 100;
const MENSAJE_EN_CURSO =
  'Tu pago se está procesando. Espera un momento y reintenta con la misma llave.';

interface Dependencias {
  repositorio: Pick<
    CheckoutRepository,
    'registrarIntento' | 'actualizarIntento' | 'liberarArrendamiento' | 'renovarArrendamiento'
  >;
  pedidos: PedidosParaCheckout;
  pasarela: PasarelaPago;
  logger: Logger;
  /** A-11: un pedido creado cambia las ventas y deja de contar su carrito como abandonado. */
  reportes: InvalidadorReportes;
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
  reportes,
  esperar = dormir,
}: Dependencias) {
  /**
   * N-03 (fencing): otro proceso tiene el intento y lo resuelve. Esta petición responde PAGO_EN_CURSO con
   * Retry-After (como mucho, lo que dura un arrendamiento): al reintentar con la misma llave, el cliente recibe
   * el resultado de quien lo tiene. La causa original queda en el log.
   */
  function arrendamientoPerdido(arrendamiento: Arrendamiento, causa: unknown): AppError {
    logger.warn(
      { err: causa, idIntento: arrendamiento.idIntento },
      'Otro proceso tiene el pago; esta petición no toca el cobro y responde PAGO_EN_CURSO',
    );
    return new AppError('PAGO_EN_CURSO', {
      mensaje: MENSAJE_EN_CURSO,
      segundosParaReintentar: SEGUNDOS_ARRENDAMIENTO,
      cause: causa,
    });
  }

  /** actualizarIntento con fencing: si el token ya no es el vigente, el arrendamiento se perdió. */
  async function actualizar(
    arrendamiento: Arrendamiento,
    cambio: CambioIntento,
  ): ReturnType<CheckoutRepository['actualizarIntento']> {
    try {
      return await repositorio.actualizarIntento(arrendamiento, cambio);
    } catch (error) {
      if (esArrendamientoPerdido(error)) throw arrendamientoPerdido(arrendamiento, error);
      throw error;
    }
  }

  async function obtenerPedido(idPedido: number): Promise<Pedido> {
    const pedido = await pedidos.obtener(idPedido);
    if (pedido === null) throw new Error(`El pedido ${String(idPedido)} del pago no existe`);
    return pedido;
  }

  async function capturar(arrendamiento: Arrendamiento, idTransaccion: string): Promise<void> {
    const { idIntento } = arrendamiento;
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
      await repositorio.actualizarIntento(arrendamiento, { estado: 'Capturado' });
    } catch (error) {
      logger.warn(
        { err: error, idIntento, idTransaccion },
        'El pago se capturó pero el intento no se actualizó; la conciliación lo cierra',
      );
    }
  }

  async function anular(
    arrendamiento: Arrendamiento,
    idTransaccion: string,
    causa: unknown,
  ): Promise<void> {
    const { idIntento } = arrendamiento;
    const codigo = causa instanceof AppError ? causa.codigo : 'ERROR_INTERNO';
    for (let intento = 1; intento <= INTENTOS_ANULACION; intento++) {
      // N-03 (fencing): cada intento puede tardar el timeout de la pasarela; antes de cada uno se retiene el
      // arrendamiento, para que un reintento del cliente no retome el intento y cree el pedido mientras se anula.
      if (!(await retenerArrendamiento(arrendamiento)))
        throw arrendamientoPerdido(arrendamiento, causa);
      try {
        await pasarela.anular(idTransaccion);
        await actualizar(arrendamiento, {
          estado: 'Anulado',
          codigo,
          mensaje: causa instanceof AppError ? causa.message : null,
        });
        logger.info({ idIntento, idTransaccion, codigo }, 'Autorización anulada: no hay pedido');
        return;
      } catch (error) {
        if (esArrendamientoPerdido(error)) {
          logger.error(
            { idIntento, idTransaccion },
            'La autorización se anuló pero otro proceso tomó el intento; lo resuelve quien lo tiene',
          );
          throw error;
        }
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
    arrendamiento: Arrendamiento,
    idTransaccion: string,
  ): Promise<Pedido> {
    const { idIntento } = arrendamiento;
    // N-03 (fencing): si otro proceso retomó el arrendamiento, esta petición ya no toca el cobro. Renovarlo
    // antes de anular impide además que, mientras tanto, un reintento retome el intento y cree el pedido.
    if (esArrendamientoPerdido(causa) || !(await retenerArrendamiento(arrendamiento)))
      throw arrendamientoPerdido(arrendamiento, causa);
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
      await anular(arrendamiento, idTransaccion, causa);
      throw causa;
    }
    logger.warn(
      { err: causa, idIntento, idPedido: pedido.idPedido },
      'El pedido se confirmó aunque la petición falló; se continúa con la captura',
    );
    return pedido;
  }

  /**
   * Renueva el arrendamiento si sigue siendo de esta petición; false si otro proceso lo tomó o si no se pudo
   * comprobar (sin saberlo, esta petición no toca el cobro).
   */
  async function retenerArrendamiento(arrendamiento: Arrendamiento): Promise<boolean> {
    try {
      return await repositorio.renovarArrendamiento(arrendamiento, SEGUNDOS_ARRENDAMIENTO);
    } catch (error) {
      // Otro rol o un intento ajeno es un bug (50005), no un arrendamiento perdido: responde 500.
      if (error instanceof AppError && error.codigo === 'INVARIANTE_INTERNA') throw error;
      logger.error(
        { err: error, idIntento: arrendamiento.idIntento },
        'No se pudo renovar el arrendamiento; el cobro queda para quien tenga el intento',
      );
      return false;
    }
  }

  async function crearPedidoYCapturar(
    arrendamiento: Arrendamiento,
    idTransaccion: string,
  ): Promise<PagoRealizado> {
    let pedido: Pedido;
    try {
      pedido = await pedidos.crearDeIntento(arrendamiento.idIntento, arrendamiento.token);
    } catch (error) {
      pedido = await pedidoTrasFalla(error, arrendamiento, idTransaccion);
    }
    // El pedido ya está confirmado (su COMMIT ocurrió): los reportes lo ven desde ahora.
    // Una venta nueva y un carrito que deja de estar activo (Convertido).
    await reportes.invalidar('ventas', 'carritos');
    await capturar(arrendamiento, idTransaccion);
    return { pedido, creado: true };
  }

  // N-03: un timeout libera el arrendamiento para que el reintento con la misma llave no espere.
  async function liberarTrasFalla(
    arrendamiento: Arrendamiento,
    operacion: 'autorizar' | 'consultar',
    causa: unknown,
  ): Promise<never> {
    const { idIntento } = arrendamiento;
    if (causa instanceof PasarelaSinRespuesta) {
      logger.warn({ err: causa, idIntento }, `La pasarela no respondió al ${operacion}`);
    } else {
      logger.error({ err: causa, idIntento }, `Error inesperado al ${operacion} en la pasarela`);
    }
    try {
      await repositorio.liberarArrendamiento(arrendamiento);
    } catch (error) {
      logger.error({ err: error, idIntento }, 'No se liberó el arrendamiento; vence solo');
    }
    throw new AppError('PAGO_SIN_CONFIRMAR', { cause: causa });
  }

  async function autorizar(
    arrendamiento: Arrendamiento,
    monto: Decimal,
    { llave, tarjeta }: SolicitudPago,
  ): Promise<PagoRealizado> {
    let resultado: ResultadoAutorizacion;
    try {
      resultado = await pasarela.autorizar({ llave, monto, tarjeta });
    } catch (error) {
      return liberarTrasFalla(arrendamiento, 'autorizar', error);
    }

    if (resultado.tipo === 'Rechazada') {
      const { intentosRestantes, sesionCancelada } = await actualizar(arrendamiento, {
        estado: 'Rechazado',
        codigo: resultado.codigo,
        mensaje: resultado.mensaje,
      });
      throw rechazo(resultado.mensaje, intentosRestantes, sesionCancelada);
    }

    await actualizar(arrendamiento, {
      estado: 'Autorizado',
      idTransaccion: resultado.idTransaccion,
    });
    return crearPedidoYCapturar(arrendamiento, resultado.idTransaccion);
  }

  /**
   * N-03 (decisión de cierre de E5): un intento retomado de una sesión vencida o cancelada nunca se
   * autoriza ni crea el pedido. Se consulta la pasarela, se anula la autorización si la hay y el intento
   * se cierra sin cobro; la respuesta es SESION_VENCIDA.
   */
  async function cerrarSinCobro(arrendamiento: Arrendamiento, llave: string): Promise<never> {
    let enPasarela: EstadoEnPasarela;
    try {
      enPasarela = await pasarela.consultar(llave);
    } catch (error) {
      return liberarTrasFalla(arrendamiento, 'consultar', error);
    }
    const vencida = new AppError('SESION_VENCIDA', {
      mensaje: 'Tu sesión de pago venció y no se hizo ningún cobro. Vuelve a iniciar el pago.',
    });
    if (enPasarela.estado === 'Autorizada') {
      await anular(arrendamiento, enPasarela.idTransaccion, vencida);
    } else if (enPasarela.estado === 'Anulada') {
      await actualizar(arrendamiento, {
        estado: 'Anulado',
        codigo: vencida.codigo,
        mensaje: null,
      });
    } else if (enPasarela.estado === 'Capturada') {
      // Sin pedido no puede haber captura: no se toca el cobro ni se dice que no hubo cobro. La conciliación lo
      // deja EnRevision y lo registra en error una sola vez; aquí basta una advertencia por petición.
      logger.warn(
        { idIntento: arrendamiento.idIntento },
        'Cobro capturado en una sesión vencida sin pedido; queda para la conciliación',
      );
      throw new AppError('PAGO_EN_REVISION', {
        mensaje:
          'Tu pago está en verificación: no vuelvas a pagar. Te contactaremos para resolverlo.',
      });
    } else {
      await actualizar(arrendamiento, {
        estado: 'Fallido',
        codigo: vencida.codigo,
      });
    }
    throw vencida;
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
          return autorizar(arrendamientoDe(registro), registro.monto, solicitud);
        case 'CrearPedido':
          return crearPedidoYCapturar(arrendamientoDe(registro), registro.idTransaccion);
        case 'Capturar':
          await capturar(arrendamientoDe(registro), registro.idTransaccion);
          return { pedido: await obtenerPedido(registro.idPedido), creado: false };
        case 'Cerrar':
          return cerrarSinCobro(arrendamientoDe(registro), solicitud.llave);
        case 'Pedido':
          return { pedido: await obtenerPedido(registro.idPedido), creado: false };
        case 'EnCurso':
          throw new AppError('PAGO_EN_CURSO', {
            mensaje: MENSAJE_EN_CURSO,
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

const esArrendamientoPerdido = (error: unknown): boolean =>
  error instanceof AppError && error.codigo === 'PAGO_EN_CURSO';

const arrendamientoDe = ({ idIntento, token }: Arrendamiento): Arrendamiento => ({
  idIntento,
  token,
});

function rechazo(mensaje: string, intentosRestantes: number, sesionCancelada: boolean): AppError {
  return new AppError('PAGO_RECHAZADO', {
    mensaje: sesionCancelada
      ? `${mensaje} Se canceló tu pago por demasiados intentos: vuelve a iniciarlo.`
      : mensaje,
    detalles: { intentosRestantes, sesionCancelada },
  });
}

export type PagoService = ReturnType<typeof crearPagoService>;
