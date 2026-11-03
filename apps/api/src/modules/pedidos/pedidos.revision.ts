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
  pasarela: Pick<PasarelaPago, 'consultar'>;
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
  async function evidenciaDe(llave: string): Promise<EstadoEnPasarela> {
    try {
      return await pasarela.consultar(llave);
    } catch (error) {
      if (error instanceof PasarelaSinRespuesta) {
        throw new AppError('PASARELA_SIN_RESPUESTA', { cause: error });
      }
      throw error;
    }
  }

  function exigirEvidencia(resolucion: ResolucionPago, enPasarela: EstadoEnPasarela): void {
    const capturada = enPasarela.estado === 'Capturada';
    if (EXIGE_CAPTURA[resolucion] && !capturada) throw new AppError('COBRO_SIN_CAPTURA');
    if (!EXIGE_CAPTURA[resolucion] && capturada) throw new AppError('COBRO_CAPTURADO');
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
      const enPasarela = await evidenciaDe(pago.llave);
      exigirEvidencia(resolucion, enPasarela);

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
      const pedido = idPedido === null ? null : await repositorio.obtener(idPedido);
      return { ...resuelto, pedido, reembolso };
    },

    resolverReembolso: (idReembolso: number, datos: ResolverReembolso): Promise<Reembolso> =>
      repositorio.resolverReembolso(idReembolso, datos),
  };
}

export type RevisionService = ReturnType<typeof crearRevisionService>;
