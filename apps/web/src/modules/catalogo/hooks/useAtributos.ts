import type { CrearAtributo, CrearValorAtributo } from '@shopcart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearAtributo, crearValorAtributo, listarAtributos } from '../catalogo.api';
import { catalogoKeys } from '../catalogo.keys';

export function useAtributos() {
  return useQuery({ queryKey: catalogoKeys.atributos(), queryFn: listarAtributos });
}

function useMutacionDeAtributos<Datos>(operacion: (datos: Datos) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: operacion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogoKeys.atributos() }),
  });
}

export const useCrearAtributo = () =>
  useMutacionDeAtributos((cuerpo: CrearAtributo) => crearAtributo(cuerpo));

export const useCrearValorAtributo = (idAtributo: number) =>
  useMutacionDeAtributos((cuerpo: CrearValorAtributo) => crearValorAtributo(idAtributo, cuerpo));
