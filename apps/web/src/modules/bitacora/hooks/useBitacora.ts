import type { ConsultaBitacora } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listarBitacora } from '../bitacora.api';
import { bitacoraKeys } from '../bitacora.keys';

export function useBitacora(consulta: ConsultaBitacora) {
  return useQuery({
    queryKey: bitacoraKeys.lista(consulta),
    queryFn: () => listarBitacora(consulta),
    placeholderData: keepPreviousData,
  });
}
