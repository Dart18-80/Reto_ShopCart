import { Aviso } from '../../../shared/componentes/Aviso';
import { Button } from '../../../shared/ui/button';
import { formatearRestante } from '../cuentaRegresiva';

interface PropsAvisoReserva {
  restanteMs: number;
  alVolverAEmpezar: () => void;
  volviendo: boolean;
}

/**
 * M4-H03 (Figma 40:971): cuánto falta para que venza la reserva de los productos (N-01). Al llegar a cero el pago
 * ya no se puede hacer y «Volver a empezar» lleva de nuevo a la dirección y el envío.
 */
export function AvisoReserva({ restanteMs, alVolverAEmpezar, volviendo }: PropsAvisoReserva) {
  if (restanteMs > 0) {
    return (
      <Aviso tipo="advertencia">
        Tus productos están apartados por{' '}
        {/* El aviso es una región que se anuncia: los segundos no se leen uno por uno. */}
        <time aria-live="off">{formatearRestante(restanteMs)}</time> minutos más.
      </Aviso>
    );
  }
  return (
    <Aviso
      tipo="error"
      acciones={
        <Button variant="outline" size="sm" disabled={volviendo} onClick={alVolverAEmpezar}>
          Volver a empezar
        </Button>
      }
    >
      Se acabó el tiempo de tu reserva: tus productos volvieron a la tienda.
    </Aviso>
  );
}
