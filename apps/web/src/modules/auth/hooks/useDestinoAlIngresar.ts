import { useSearchParams } from 'react-router';
import { useSesion } from '../../../shared/hooks/useSesion';
import { destinoAlIngresar } from '../destino';

export const PARAMETRO_VOLVER = 'volver';

/** Con sesión abierta, a dónde debe ir quien está en /ingresar o /registro; sin sesión, null. */
export function useDestinoAlIngresar(): string | null {
  const [busqueda] = useSearchParams();
  const { usuario } = useSesion();
  return usuario ? destinoAlIngresar(busqueda.get(PARAMETRO_VOLVER), usuario.rol) : null;
}

/** La misma `?volver=` para pasar de /ingresar a /registro y al revés. */
export function useBusquedaConVolver(): string {
  const [busqueda] = useSearchParams();
  const volver = busqueda.get(PARAMETRO_VOLVER);
  return volver === null
    ? ''
    : `?${new URLSearchParams({ [PARAMETRO_VOLVER]: volver }).toString()}`;
}
