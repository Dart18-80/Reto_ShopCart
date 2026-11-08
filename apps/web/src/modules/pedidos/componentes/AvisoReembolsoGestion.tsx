import { Aviso } from '../../../shared/componentes/Aviso';
import { formatearMonto } from '../../../shared/formato/monto';
import type { EstadoReembolso } from '../pedidos.api';

// N-09, N-10: lo que pasó con el dinero, dicho al personal, según el estado que responde el backend.
const POR_ESTADO: Record<EstadoReembolso, (monto: string) => string> = {
  Pendiente: (monto) => `El reembolso de ${monto} quedó en proceso.`,
  Completado: (monto) => `El reembolso de ${monto} se completó.`,
  Fallido: (monto) =>
    `El reembolso de ${monto} falló: queda en Reembolsos para reintentarlo o resolverlo.`,
  ResueltoManual: (monto) => `El reembolso de ${monto} se resolvió a mano.`,
  NoAplica: () => 'No hubo cobro a la tarjeta: no hay nada que reembolsar.',
};

interface PropsAvisoReembolso {
  /** Qué se hizo: «Cancelamos el pedido.» o «Registramos la devolución.» */
  hecho: string;
  /** El monto tal como lo calculó el backend (FE-10). */
  monto: string;
  estado: EstadoReembolso;
}

/** M8-H03 y M8-H04: el resultado de cancelar o devolver, con el reembolso que creó el backend. */
export function AvisoReembolsoGestion({ hecho, monto, estado }: PropsAvisoReembolso) {
  return (
    <Aviso tipo={estado === 'Fallido' ? 'advertencia' : 'exito'}>
      {`${hecho} ${POR_ESTADO[estado](formatearMonto(monto))}`}
    </Aviso>
  );
}
