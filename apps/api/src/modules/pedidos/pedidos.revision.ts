import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
  type PasarelaPago,
} from '../../shared/pasarela/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import { SEGUNDOS_ANTES_DE_RESOLVER_A_MANO, type ReembolsosService } from './pedidos.reembolsos.js';
import type { PedidosRepository } from './pedidos.repository.js';
import type { ListarPagosEnRevision, ResolverPago, ResolverReembolso } from './pedidos.schemas.js';
import type {
  PagoEnRevision,
  Pedido,
  Reembolso,
  ReembolsoParaResolver,
  ResolucionDePago,
  ResolucionPago,
} from './pedidos.types.js';

interface Dependencias {
  repositorio: Pick<
    PedidosRepository,
    | 'listarPagosEnRevision'
    | 'obtenerPagoEnRevision'
    | 'resolverPago'
    | 'obtenerReembolsoParaResolver'
    | 'completarReembolsoProcesado'
    | 'marcarReembolsoNoAplica'
    | 'resolverReembolso'
    | 'obtener'
  >;
  pasarela: Pick<PasarelaPago, 'consultar' | 'anular' | 'consultarReembolso'>;
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

// Decisión del PO (E9-H04): sin cobro capturado no hay dinero que devolver; el motivo dice qué mostró la pasarela.
const SIN_COBRO: Record<Exclude<EstadoEnPasarela['estado'], 'Capturada'>, string> = {
  NoExiste: 'La pasarela no tiene el cobro: no hubo dinero que devolver.',
  Rechazada: 'La pasarela rechazó el cobro: no hubo dinero que devolver.',
  Autorizada:
    'La autorización nunca se capturó (se anuló al resolver): no hubo dinero que devolver.',
  Anulada: 'La autorización se anuló sin capturarse: no hubo dinero que devolver.',
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

  async function obtenerReembolsoFallido(idReembolso: number): Promise<ReembolsoParaResolver> {
    const reembolso = await repositorio.obtenerReembolsoParaResolver(
      idReembolso,
      SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
    );
    if (reembolso === null) {
      throw new AppError('NO_ENCONTRADO', { mensaje: 'El reembolso no existe.' });
    }
    if (reembolso.estado !== 'Fallido') throw new AppError('REEMBOLSO_NO_FALLIDO');
    // Prevalidación: el SP vuelve a exigir el plazo bajo bloqueo.
    if (!reembolso.plazoCumplido) throw new AppError('REEMBOLSO_RECIENTE');
    return reembolso;
  }

  /** Si la pasarela ya lo devolvió (se perdió la respuesta), queda Completado: resolverlo a mano pagaría dos veces. */
  async function cerrarSiYaSeProceso(
    idReembolso: number,
    { llave }: ReembolsoParaResolver,
  ): Promise<void> {
    const enPasarela = await enLaPasarela(() => pasarela.consultarReembolso(llave));
    if (enPasarela.estado !== 'Procesado') return;
    await repositorio.completarReembolsoProcesado(idReembolso, enPasarela.idReembolso);
    throw new AppError('REEMBOLSO_YA_PROCESADO');
  }

  /**
   * Si el cobro nunca se capturó o se anuló, no hay dinero que devolver: queda NoAplica. Una autorización vigente se
   * anula antes, como en SinCobro, para que no quede dinero retenido.
   */
  async function cerrarSiNoHuboCobro(
    idReembolso: number,
    reembolso: ReembolsoParaResolver,
  ): Promise<void> {
    const cobro = await enLaPasarela(() => pasarela.consultar(reembolso.llaveIntento));
    if (cobro.estado === 'Capturada') return;
    if (cobro.estado === 'Autorizada') {
      await enLaPasarela(() => pasarela.anular(cobro.idTransaccion));
    }
    await repositorio.marcarReembolsoNoAplica(
      idReembolso,
      SIN_COBRO[cobro.estado],
      reembolso.fechaActualizacion,
      SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
    );
    throw new AppError('REEMBOLSO_SIN_COBRO');
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

    /**
     * Decisión del PO: antes de aceptar la resolución manual se consulta la pasarela, el reembolso por su llave y el
     * cobro por la del intento. Si entre la consulta y la escritura alguien lo reintenta, el SP lo detecta por su
     * fecha de actualización (409).
     */
    async resolverReembolso(idReembolso: number, datos: ResolverReembolso): Promise<Reembolso> {
      const reembolso = await obtenerReembolsoFallido(idReembolso);
      await cerrarSiYaSeProceso(idReembolso, reembolso);
      await cerrarSiNoHuboCobro(idReembolso, reembolso);
      return repositorio.resolverReembolso(
        idReembolso,
        datos,
        reembolso.fechaActualizacion,
        SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
      );
    },
  };
}

export type RevisionService = ReturnType<typeof crearRevisionService>;
