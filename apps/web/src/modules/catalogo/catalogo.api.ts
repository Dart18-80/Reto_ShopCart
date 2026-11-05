import type { ConsultaBusqueda } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ResultadoBusqueda = Respuesta<'/api/v1/productos', 'get'>;
export type ProductoBusqueda = ResultadoBusqueda['datos'][number];
export type Categoria = Respuesta<'/api/v1/categorias', 'get'>['datos'][number];
export type ProductoTienda = Respuesta<'/api/v1/productos/{id}', 'get'>['datos'];
export type EstadoExistencia = ProductoTienda['variantes'][number]['estadoExistencia'];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function cuerpoDe<D>(data: D | undefined): D {
  if (data === undefined) throw ErrorApi.inesperado();
  return data;
}

/** La consulta validada vuelve a la forma de la query string: el booleano viaja como 'true' o 'false'. */
export async function buscarProductos({ disponible, ...consulta }: ConsultaBusqueda) {
  const { data } = await api.GET('/api/v1/productos', {
    params: {
      query: {
        ...consulta,
        disponible: disponible === undefined ? undefined : disponible ? 'true' : 'false',
      },
    },
  });
  return cuerpoDe(data);
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await api.GET('/api/v1/categorias');
  return cuerpoDe(data).datos;
}
