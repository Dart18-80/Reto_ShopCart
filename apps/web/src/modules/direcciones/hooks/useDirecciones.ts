import { useQuery } from '@tanstack/react-query';
import { listarDepartamentos, listarDirecciones, listarMunicipios } from '../direcciones.api';
import { direccionesKeys } from '../direcciones.keys';

export function useDirecciones() {
  return useQuery({ queryKey: direccionesKeys.lista(), queryFn: listarDirecciones });
}

// Los departamentos y municipios de Guatemala no cambian mientras se usa la tienda.
const SIN_VENCER = Infinity;

export function useDepartamentos() {
  return useQuery({
    queryKey: direccionesKeys.departamentos(),
    queryFn: listarDepartamentos,
    staleTime: SIN_VENCER,
  });
}

/** Los municipios del departamento elegido; sin departamento no consulta. */
export function useMunicipios(idDepartamento: number | undefined) {
  return useQuery({
    queryKey: direccionesKeys.municipios(idDepartamento ?? 0),
    queryFn: () => listarMunicipios(idDepartamento ?? 0),
    enabled: idDepartamento !== undefined,
    staleTime: SIN_VENCER,
  });
}
