import { useQuery } from '@tanstack/react-query';
import { listarMetodosParaCarrito } from '../envios.api';
import { enviosKeys } from '../envios.keys';

/** Los métodos de envío para el carrito actual: el costo y el total cambian con el carrito, por eso no se guardan. */
export function useMetodosEnvio() {
  return useQuery({ queryKey: enviosKeys.paraCarrito(), queryFn: listarMetodosParaCarrito });
}
