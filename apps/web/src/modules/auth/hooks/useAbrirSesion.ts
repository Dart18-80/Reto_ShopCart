import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sesion } from '../../../shared/api';
import type { SesionAbierta } from '../auth.api';
import { textoDelAviso } from '../avisosCarrito';

/**
 * Login y registro terminan igual: la sesión se abre en todas las pestañas (FE-05) y se avisan los cambios de la
 * fusión del carrito (N-05). La navegación la decide la página: con sesión abierta, lleva al destino.
 */
export function useAbrirSesion<Datos>(llamar: (datos: Datos) => Promise<SesionAbierta>) {
  return useMutation({
    mutationFn: llamar,
    onSuccess: (abierta) => {
      sesion.establecer(abierta);
      for (const aviso of abierta.avisosCarrito ?? []) toast.info(textoDelAviso(aviso));
    },
  });
}
