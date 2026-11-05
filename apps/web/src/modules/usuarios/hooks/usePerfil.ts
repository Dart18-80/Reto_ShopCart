import { useQuery } from '@tanstack/react-query';
import { obtenerPerfil } from '../usuarios.api';
import { usuariosKeys } from '../usuarios.keys';

export function usePerfil() {
  return useQuery({ queryKey: usuariosKeys.perfil(), queryFn: obtenerPerfil });
}
