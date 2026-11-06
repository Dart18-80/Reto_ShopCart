import type {
  ActualizarCategoria,
  ConsultaBusqueda,
  ConsultaProductosAdmin,
  CrearAtributo,
  CrearCategoria,
  CrearProducto,
  CrearValorAtributo,
} from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type ResultadoBusqueda = Respuesta<'/api/v1/productos', 'get'>;
export type ProductoBusqueda = ResultadoBusqueda['datos'][number];
export type Categoria = Respuesta<'/api/v1/categorias', 'get'>['datos'][number];
export type ProductoTienda = Respuesta<'/api/v1/productos/{id}', 'get'>['datos'];
export type EstadoExistencia = ProductoTienda['variantes'][number]['estadoExistencia'];
export type CategoriaAdmin = Respuesta<'/api/v1/admin/categorias', 'get'>['datos'][number];
export type Atributo = Respuesta<'/api/v1/admin/atributos', 'get'>['datos'][number];
export type ListaProductosAdmin = Respuesta<'/api/v1/admin/productos', 'get'>;
export type ProductoResumenAdmin = ListaProductosAdmin['datos'][number];
export type ProductoAdmin = Respuesta<'/api/v1/admin/productos/{id}', 'get'>['datos'];
/** M6-H02: lo que el Admin hace con una categoría desde su fila. */
export type AccionCategoria = 'activar' | 'desactivar' | 'eliminar';

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

export async function obtenerProducto(idProducto: number): Promise<ProductoTienda> {
  const { data } = await api.GET('/api/v1/productos/{id}', {
    params: { path: { id: idProducto } },
  });
  return cuerpoDe(data).datos;
}

// --- Backoffice (M6-H02): categorías y atributos, solo Admin.

export async function listarCategoriasAdmin(): Promise<CategoriaAdmin[]> {
  const { data } = await api.GET('/api/v1/admin/categorias');
  return cuerpoDe(data).datos;
}

export async function crearCategoria(cuerpo: CrearCategoria): Promise<void> {
  await api.POST('/api/v1/admin/categorias', { body: cuerpo });
}

export async function actualizarCategoria(
  idCategoria: number,
  cambios: ActualizarCategoria,
): Promise<void> {
  await api.PATCH('/api/v1/admin/categorias/{id}', {
    params: { path: { id: idCategoria } },
    body: cambios,
  });
}

/** N-14: activar, desactivar o eliminar; el backend decide si se puede (CATEGORIA_CON_PRODUCTOS, en uso). */
export async function cambiarCategoria(
  idCategoria: number,
  accion: AccionCategoria,
): Promise<void> {
  const params = { path: { id: idCategoria } };
  if (accion === 'eliminar') {
    await api.DELETE('/api/v1/admin/categorias/{id}', { params });
  } else if (accion === 'activar') {
    await api.POST('/api/v1/admin/categorias/{id}/activar', { params });
  } else {
    await api.POST('/api/v1/admin/categorias/{id}/desactivar', { params });
  }
}

export async function listarAtributos(): Promise<Atributo[]> {
  const { data } = await api.GET('/api/v1/admin/atributos');
  return cuerpoDe(data).datos;
}

export async function crearAtributo(cuerpo: CrearAtributo): Promise<void> {
  await api.POST('/api/v1/admin/atributos', { body: cuerpo });
}

export async function crearValorAtributo(
  idAtributo: number,
  cuerpo: CrearValorAtributo,
): Promise<void> {
  await api.POST('/api/v1/admin/atributos/{id}/valores', {
    params: { path: { id: idAtributo } },
    body: cuerpo,
  });
}

// --- Backoffice (M6-H03): productos, solo Admin.

/** La consulta validada vuelve a la forma de la query string: el booleano viaja como 'true' o 'false'. */
export async function listarProductosAdmin({
  activo,
  ...consulta
}: ConsultaProductosAdmin): Promise<ListaProductosAdmin> {
  const { data } = await api.GET('/api/v1/admin/productos', {
    params: {
      query: {
        ...consulta,
        activo: activo === undefined ? undefined : activo ? 'true' : 'false',
      },
    },
  });
  return cuerpoDe(data);
}

export async function crearProducto(cuerpo: CrearProducto): Promise<ProductoAdmin> {
  const { data } = await api.POST('/api/v1/admin/productos', { body: cuerpo });
  return cuerpoDe(data).datos;
}
