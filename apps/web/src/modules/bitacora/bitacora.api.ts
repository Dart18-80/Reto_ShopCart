import type { ConsultaBitacora } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ListaBitacora = Respuesta<'/api/v1/bitacora', 'get'>;
export type RegistroBitacora = ListaBitacora['datos'][number];

/** RF-09 (solo Admin): la bitácora, de solo lectura; los valores llegan como el JSON que guardó el trigger. */
export async function listarBitacora(consulta: ConsultaBitacora): Promise<ListaBitacora> {
  const { data } = await api.GET('/api/v1/bitacora', { params: { query: consulta } });
  if (!data) throw ErrorApi.inesperado();
  return data;
}
