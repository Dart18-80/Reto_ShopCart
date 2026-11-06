import { Aviso } from '../../../shared/componentes/Aviso';
import { formatearMonto } from '../../../shared/formato/monto';
import type { Cancelacion, EstadoReembolso } from '../pedidos.api';

// N-09: lo que pasa con el dinero según el estado del reembolso que responde el backend.
const POR_ESTADO: Record<EstadoReembolso, (monto: string) => string> = {
  Pendiente: (monto) => `El reembolso de ${monto} a tu tarjeta está en proceso.`,
  Completado: (monto) => `El reembolso de ${monto} ya está en tu tarjeta.`,
  Fallido: (monto) =>
    `El reembolso de ${monto} tuvo un problema y nuestro equipo lo está resolviendo.`,
  ResueltoManual: (monto) => `Nuestro equipo resolvió el reembolso de ${monto}.`,
  NoAplica: () => 'No se hizo ningún cobro a tu tarjeta, así que no hay nada que reembolsar.',
};

/** M5-H02: el aviso tras cancelar, con el monto reembolsado tal como llega en el pedido (FE-10). */
export function AvisoCancelacion({
  cancelacion: { pedido, reembolso },
}: {
  cancelacion: Cancelacion;
}) {
  return (
    <Aviso tipo="exito">
      {`Cancelamos tu pedido. ${POR_ESTADO[reembolso.estado](formatearMonto(pedido.montoReembolsado))}`}
    </Aviso>
  );
}
