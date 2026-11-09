import type { ActualizarCupon, ConsultaCupones, CrearCupon } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ListaCupones = Respuesta<'/api/v1/admin/cupones', 'get'>;
export type Cupon = ListaCupones['datos'][number];
export type AccionCupon = 'activar' | 'desactivar';

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function cuerpoDe<D>(data: D | undefined): D {
  if (data === undefined) throw ErrorApi.inesperado();
  return data;
}

// RF-05, N-12 (solo Admin). Los montos y porcentajes van y vienen como texto (FE-10).

/** La consulta validada vuelve a la forma de la query string: el booleano viaja como 'true' o 'false'. */
export async function listarCupones({
  activo,
  ...consulta
}: ConsultaCupones): Promise<ListaCupones> {
  const { data } = await api.GET('/api/v1/admin/cupones', {
    params: {
      query: { ...consulta, activo: activo === undefined ? undefined : activo ? 'true' : 'false' },
    },
  });
  return cuerpoDe(data);
}

export async function crearCupon(cuerpo: CrearCupon): Promise<Cupon> {
  const { data } = await api.POST('/api/v1/admin/cupones', { body: cuerpo });
  return cuerpoDe(data).datos;
}

/** PATCH: lo que no se envía se conserva; el SP decide qué se puede cambiar de un cupón ya usado. */
export async function actualizarCupon(idCupon: number, cuerpo: ActualizarCupon): Promise<Cupon> {
  const { data } = await api.PATCH('/api/v1/admin/cupones/{id}', {
    params: { path: { id: idCupon } },
    body: cuerpo,
  });
  return cuerpoDe(data).datos;
}

export async function cambiarEstadoCupon(idCupon: number, accion: AccionCupon): Promise<Cupon> {
  const ruta =
    accion === 'activar'
      ? '/api/v1/admin/cupones/{id}/activar'
      : '/api/v1/admin/cupones/{id}/desactivar';
  const { data } = await api.POST(ruta, { params: { path: { id: idCupon } } });
  return cuerpoDe(data).datos;
}
