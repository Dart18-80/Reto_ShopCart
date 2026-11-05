import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sesion } from '../../../shared/api';
import { cambiarContrasena } from '../usuarios.api';

/**
 * A-07: el backend revoca las demás sesiones del usuario y devuelve una nueva para este dispositivo; al adoptarla,
 * las otras pestañas la reciben por el canal (FE-05).
 */
export function useCambiarContrasena() {
  return useMutation({
    mutationFn: cambiarContrasena,
    onSuccess: (renovada) => {
      sesion.establecer(renovada);
      toast.success('Contraseña actualizada. Cerramos tu sesión en los demás dispositivos.');
    },
  });
}
