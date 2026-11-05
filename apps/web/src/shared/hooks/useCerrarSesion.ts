import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sesion } from '../api';

const AVISO_SIN_CERRAR = 'No pudimos cerrar tu sesión; intenta de nuevo.';

/**
 * Cierra la sesión en el servidor y en todas las pestañas (FE-05). Si el logout falla, la sesión sigue abierta y
 * el botón disponible para reintentar.
 */
export function useCerrarSesion() {
  return useMutation({
    mutationFn: () => sesion.cerrar(),
    onError: () => {
      toast.error(AVISO_SIN_CERRAR);
    },
  });
}
