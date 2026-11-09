import { Navigate } from 'react-router';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { PasoPago } from '../componentes/PasoPago';
import { PasosDelCheckout } from '../componentes/PasosDelCheckout';
import { useSesionPago } from '../hooks/useSesionPago';
import { RUTAS } from '../../../shared/rutas';

// La sesión es una sola o null (404): nunca es una lista vacía.
const SIN_USO = { titulo: '' };

/** M4-H03, `/checkout/pago`: sin una sesión de pago Activa no hay nada que pagar y vuelve al primer paso (05 §6). */
export function PagoPagina() {
  useTituloPagina('Pagar');
  const sesion = useSesionPago();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="display-titulo-1">Pagar</h1>
      <PasosDelCheckout actual={2} />
      <EstadoVista consulta={sesion} vacio={SIN_USO}>
        {(activa) =>
          activa ? <PasoPago sesion={activa} /> : <Navigate to={RUTAS.checkout} replace />
        }
      </EstadoVista>
    </div>
  );
}
