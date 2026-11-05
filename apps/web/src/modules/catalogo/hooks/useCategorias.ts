import { useQuery } from '@tanstack/react-query';
import { listarCategorias } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

export function useCategorias() {
  return useQuery({ queryKey: catalogoKeys.categorias(), queryFn: listarCategorias });
}
