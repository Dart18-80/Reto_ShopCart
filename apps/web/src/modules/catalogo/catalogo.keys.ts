import type { ConsultaBusqueda, ConsultaProductosAdmin } from '@shopcart/shared';

export const catalogoKeys = {
  todo: ['catalogo'] as const,
  busquedas: () => [...catalogoKeys.todo, 'busqueda'] as const,
  busqueda: (consulta: ConsultaBusqueda) => [...catalogoKeys.busquedas(), consulta] as const,
  categorias: () => [...catalogoKeys.todo, 'categorias'] as const,
  producto: (idProducto: number) => [...catalogoKeys.todo, 'producto', idProducto] as const,
  admin: () => [...catalogoKeys.todo, 'admin'] as const,
  categoriasAdmin: () => [...catalogoKeys.admin(), 'categorias'] as const,
  atributos: () => [...catalogoKeys.admin(), 'atributos'] as const,
  productosAdmin: () => [...catalogoKeys.admin(), 'productos'] as const,
  listaProductosAdmin: (consulta: ConsultaProductosAdmin) =>
    [...catalogoKeys.productosAdmin(), 'lista', consulta] as const,
  productoAdmin: (idProducto: number) =>
    [...catalogoKeys.productosAdmin(), 'detalle', idProducto] as const,
};
