import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sesion } from '../api';

/** Cierra la sesión en el servidor y en todas las pestañas; la local se cierra aunque el logout falle (FE-05). */
export function useCerrarSesion() {
  return useMutation({
    mutationFn: () => sesion.cerrar(),
    onError: (error) => {
      toast.error(error.mensaje);
    },
  });
}
