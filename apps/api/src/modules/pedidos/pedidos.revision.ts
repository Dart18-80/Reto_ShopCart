import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
  type PasarelaPago,
} from '../../shared/pasarela/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { ReembolsosService } from './pedidos.reembolsos.js';
import type { PedidosRepository } from './pedidos.repository.js';
import type { ListarPagosEnRevision, ResolverPago, ResolverReembolso } from './pedidos.schemas.js';
import type {
  PagoEnRevision,
  Pedido,
  Reembolso,
  ResolucionDePago,
  ResolucionPago,
} from './pedidos.types.js';

interface Dependencias {
  repositorio: Pick<
    PedidosRepository,
    | 'listarPagosEnRevision'
    | 'obtenerPagoEnRevision'
    | 'resolverPago'
    | 'resolverReembolso'
    | 'obtener'
  >;
  pasarela: Pick<PasarelaPago, 'consultar' | 'anular'>;
  reembolsos: Pick<ReembolsosService, 'procesarTrasConfirmar'>;
  /** A-11: SinCobro cancela el pedido y cambia las ventas de los reportes. */
  reportes: InvalidadorReportes;
}

// Decisión del PO (E9-H04): el Admin decide con evidencia. Verificar el cobro o reembolsarlo exige que la pasarela
// lo tenga capturado; cancelar sin cobro exige que no.
const EXIGE_CAPTURA: Record<ResolucionPago, boolean> = {
  CobroVerificado: true,
  Reembolsar: true,
  SinCobro: false,
};

// Reembolsar es para un cobro sin pedido; las otras dos, para un pago con pedido. Mismos mensajes que el SP (50708).
const NO_APLICA: Record<ResolucionPago, { conPedido: boolean; mensaje: string }> = {
  CobroVerificado: {
    conPedido: true,
    mensaje: 'Este cobro no tiene pedido: solo se puede reembolsar.',
  },
  SinCobro: { conPedido: true, mensaje: 'Este cobro no tiene pedido: solo se puede reembolsar.' },
  Reembolsar: {
    conPedido: false,
    mensaje: 'Este pago tiene pedido: verifica el cobro o cancela el pedido sin cobro.',
  },
};

/**
 * E9-H04: la revisión manual de un pago EnRevision y de un reembolso Fallido. La pasarela se consulta fuera de
 * toda transacción; el SP vuelve a validar bajo bloqueo (A-02) y es el que decide quién gana entre dos
 * resoluciones simultáneas.
 */
export function crearRevisionService({
  repositorio,
  pasarela,
  reembolsos,
  reportes,
}: Dependencias) {
  async function enLaPasarela<T>(llamada: () => Promise<T>): Promise<T> {
    try {
      return await llamada();
    } catch (error) {
      if (error instanceof PasarelaSinRespuesta) {
        throw new AppError('PASARELA_SIN_RESPUESTA', { cause: error });
      }
      throw error;
    }
  }

  function exigirQueAplique(resolucion: ResolucionPago, idPedido: number | null): void {
    const { conPedido, mensaje } = NO_APLICA[resolucion];
    if (conPedido !== (idPedido !== null)) throw new AppError('RESOLUCION_NO_APLICA', { mensaje });
  }

  function exigirEvidencia(resolucion: ResolucionPago, enPasarela: EstadoEnPasarela): void {
    const capturada = enPasarela.estado === 'Capturada';
    if (EXIGE_CAPTURA[resolucion] && !capturada) throw new AppError('COBRO_SIN_CAPTURA');
    if (!EXIGE_CAPTURA[resolucion] && capturada) throw new AppError('COBRO_CAPTURADO');
  }

  async function pedidoResuelto(idPedido: number | null): Promise<Pedido | null> {
    if (idPedido === null) return null;
    const pedido = await repositorio.obtener(idPedido);
    if (pedido === null)
      throw new Error(`El pedido ${String(idPedido)} del pago resuelto no existe`);
    return pedido;
  }

  return {
    listarPagosEnRevision: (filtros: ListarPagosEnRevision): Promise<PaginaSP<PagoEnRevision>> =>
      repositorio.listarPagosEnRevision(filtros),

    async resolverPago(
      idIntentoPago: number,
      { resolucion, motivo }: ResolverPago,
    ): Promise<ResolucionDePago> {
      const pago = await repositorio.obtenerPagoEnRevision(idIntentoPago);
      if (pago === null) {
        throw new AppError('NO_ENCONTRADO', { mensaje: 'El intento de pago no existe.' });
      }
      if (pago.estado !== 'EnRevision') throw new AppError('PAGO_NO_EN_REVISION');
      exigirQueAplique(resolucion, pago.idPedido);
      const enPasarela = await enLaPasarela(() => pasarela.consultar(pago.llave));
      exigirEvidencia(resolucion, enPasarela);
      // Sin cobro tampoco queda una autorización retenida: se anula antes de escribir, y si la pasarela falla
      // nada cambia.
      if (enPasarela.estado === 'Autorizada') {
        await enLaPasarela(() => pasarela.anular(enPasarela.idTransaccion));
      }

      const idTransaccion = enPasarela.estado === 'Capturada' ? enPasarela.idTransaccion : null;
      const escritura = repositorio.resolverPago(idIntentoPago, resolucion, motivo, idTransaccion);
      const { idPedido, idReembolso, ...resuelto } =
        resolucion === 'SinCobro' ? await reportes.tras(escritura, 'ventas') : await escritura;

      const reembolso =
        idReembolso === null
          ? null
          : {
              idReembolso,
              estado: await reembolsos.procesarTrasConfirmar(idReembolso, { idIntentoPago }),
            };
      return { ...resuelto, pedido: await pedidoResuelto(idPedido), reembolso };
    },

    resolverReembolso: (idReembolso: number, datos: ResolverReembolso): Promise<Reembolso> =>
      repositorio.resolverReembolso(idReembolso, datos),
  };
}

export type RevisionService = ReturnType<typeof crearRevisionService>;
