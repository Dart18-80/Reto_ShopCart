import { WifiOff } from 'lucide-react';
import type { ErrorApi } from '../../shared/api';
import { Button } from '../../shared/ui/button';
import { AvisoDePagina } from '../../shared/componentes/AvisoDePagina';

interface PropsSesionSinVerificar {
  error: ErrorApi | null;
  onReintentar: () => void;
}

/** 05 §5: la rehidratación falló por red o 5xx; no se sabe si hay sesión, así que no se manda al login. */
export function SesionSinVerificar({ error, onReintentar }: PropsSesionSinVerificar) {
  return (
    <AvisoDePagina
      icono={WifiOff}
      titulo="No pudimos verificar tu sesión"
      acciones={<Button onClick={onReintentar}>Reintentar</Button>}
    >
      <p>{error?.mensaje}</p>
      {error?.requestId && (
        <p className="texto-nota mt-2">Código de la solicitud: {error.requestId}</p>
      )}
    </AvisoDePagina>
  );
}
