import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sesion } from '../../../shared/api';
import { actualizarPerfil } from '../usuarios.api';
import { usuariosKeys } from '../usuarios.keys';

export function useActualizarPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: actualizarPerfil,
    onSuccess: async (perfil) => {
      // El nombre que se ve en el menú de la cuenta y en el backoffice es el que confirmó el backend.
      sesion.actualizarNombre(perfil.nombre);
      await queryClient.invalidateQueries({ queryKey: usuariosKeys.perfil() });
      toast.success('Tus datos se guardaron.');
    },
  });
}
