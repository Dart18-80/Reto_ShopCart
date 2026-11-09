import { Navigate } from 'react-router';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { PasoDireccionYEnvio } from '../componentes/PasoDireccionYEnvio';
import { PasosDelCheckout } from '../componentes/PasosDelCheckout';
import { useSesionPago } from '../hooks/useSesionPago';
import { RUTAS } from '../../../shared/rutas';

// La sesión es una sola o null (404): nunca es una lista vacía.
const SIN_USO = { titulo: '' };

/** M4-H02, `/checkout`: con una sesión de pago Activa el Cliente ya pasó este paso y va a `/checkout/pago` (05 §6). */
export function CheckoutPagina() {
  useTituloPagina('Pagar');
  const sesion = useSesionPago();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="display-titulo-1">Pagar</h1>
      <PasosDelCheckout actual={1} />
      <EstadoVista consulta={sesion} vacio={SIN_USO}>
        {(activa) => (activa ? <Navigate to={RUTAS.pago} replace /> : <PasoDireccionYEnvio />)}
      </EstadoVista>
    </div>
  );
}
