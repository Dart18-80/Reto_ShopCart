import { AppError } from '../../shared/errors/index.js';
import { metricasDeNegocio } from '../../shared/observability/index.js';
import type { PagoService } from './checkout.pago.js';

/** E9-H01: cuenta el resultado de cada pago y los pedidos creados, sin tocar el flujo del pago. */
export function conMetricasDePago(pago: Pick<PagoService, 'pagar'>): Pick<PagoService, 'pagar'> {
  return {
    async pagar(solicitud) {
      try {
        const realizado = await pago.pagar(solicitud);
        if (realizado.creado) metricasDeNegocio.pedidoCreado();
        metricasDeNegocio.pagoResuelto(realizado.creado ? 'PedidoCreado' : 'Repetido');
        return realizado;
      } catch (error) {
        metricasDeNegocio.pagoResuelto(error instanceof AppError ? error.codigo : 'ERROR_INTERNO');
        throw error;
      }
    },
  };
}
