import { AppError } from '../../shared/errors/index.js';
import { paginar, type RespuestaPaginada } from '../../shared/http/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { CatalogoRepository } from './catalogo.repository.js';
import type {
  ActualizarCategoria,
  ActualizarProducto,
  ActualizarVariante,
  CambiarPrecio,
  CrearAtributo,
  CrearCategoria,
  CrearProducto,
  CrearValorAtributo,
  CrearVariante,
  GuardarImagenes,
} from './catalogo.schemas.js';
import type {
  Atributo,
  Categoria,
  CategoriaPublica,
  FiltrosBusqueda,
  FiltrosProductos,
  ProductoAdmin,
  ProductoBusqueda,
  ProductoResumen,
  ProductoTienda,
  ValorAtributoCreado,
  VersionPrecio,
} from './catalogo.types.js';

interface Dependencias {
  repositorio: CatalogoRepository;
  /** A-11: los nombres, el precio vigente y las variantes borradas cambian lo que muestran los reportes. */
  reportes: InvalidadorReportes;
}

function productoExistente<T extends ProductoAdmin | ProductoTienda>(producto: T | null): T {
  if (producto === null) throw new AppError('NO_ENCONTRADO', { mensaje: 'El producto no existe.' });
  return producto;
}

// N-14: las reglas del catálogo (nombres únicos, categoría activa, conjunto de atributos, combinación y
// SKU únicos, historial) las garantiza el SP bajo bloqueo; el servicio solo orquesta.
export function crearCatalogoService({ repositorio, reportes }: Dependencias) {
  return {
    listarCategorias: (): Promise<CategoriaPublica[]> => repositorio.listarCategorias(),

    crearCategoria: (datos: CrearCategoria): Promise<Categoria> =>
      repositorio.crearCategoria(datos),

    actualizarCategoria: (id: number, cambios: ActualizarCategoria): Promise<Categoria> =>
      reportes.tras(repositorio.actualizarCategoria(id, cambios), 'ventas'),

    activarCategoria: (id: number): Promise<Categoria> =>
      repositorio.cambiarEstadoCategoria(id, true),

    desactivarCategoria: (id: number): Promise<Categoria> =>
      repositorio.cambiarEstadoCategoria(id, false),

    eliminarCategoria: (id: number): Promise<void> => repositorio.eliminarCategoria(id),

    listarAtributos: (): Promise<Atributo[]> => repositorio.listarAtributos(),

    crearAtributo: (datos: CrearAtributo): Promise<Atributo> => repositorio.crearAtributo(datos),

    crearValorAtributo: (
      idAtributo: number,
      datos: CrearValorAtributo,
    ): Promise<ValorAtributoCreado> => repositorio.crearValorAtributo(idAtributo, datos),

    // RF-02, A-10: búsqueda pública; el SP valida el orden contra su lista blanca.
    async buscarProductos(filtros: FiltrosBusqueda): Promise<RespuestaPaginada<ProductoBusqueda>> {
      const { productos, total } = await repositorio.buscarProductos(filtros);
      return paginar(productos, total, filtros);
    },

    async listarProductosAdmin(
      filtros: FiltrosProductos,
    ): Promise<RespuestaPaginada<ProductoResumen>> {
      const { productos, total } = await repositorio.listarProductosAdmin(filtros);
      return paginar(productos, total, filtros);
    },

    obtenerProductoAdmin: async (id: number): Promise<ProductoAdmin> =>
      productoExistente(await repositorio.obtenerProductoAdmin(id)),

    // N-06: un producto inactivo o sin variantes activas no existe para la tienda (404).
    obtenerProductoTienda: async (id: number): Promise<ProductoTienda> =>
      productoExistente(await repositorio.obtenerProductoTienda(id)),

    crearProducto: (datos: CrearProducto): Promise<ProductoAdmin> =>
      repositorio.crearProducto(datos),

    actualizarProducto: (id: number, cambios: ActualizarProducto): Promise<ProductoAdmin> =>
      reportes.tras(repositorio.actualizarProducto(id, cambios), 'ventas'),

    activarProducto: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoProducto(id, true),

    desactivarProducto: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoProducto(id, false),

    eliminarProducto: (id: number): Promise<void> =>
      reportes.tras(repositorio.eliminarProducto(id), 'carritos'),

    guardarImagenes: (id: number, datos: GuardarImagenes): Promise<ProductoAdmin> =>
      repositorio.guardarImagenes(id, datos),

    crearVariante: (idProducto: number, datos: CrearVariante): Promise<ProductoAdmin> =>
      repositorio.crearVariante(idProducto, datos),

    actualizarVariante: (id: number, cambios: ActualizarVariante): Promise<ProductoAdmin> =>
      repositorio.actualizarVariante(id, cambios),

    activarVariante: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoVariante(id, true),

    desactivarVariante: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoVariante(id, false),

    eliminarVariante: (id: number): Promise<void> =>
      reportes.tras(repositorio.eliminarVariante(id), 'carritos'),

    historialPrecios: (idVariante: number): Promise<VersionPrecio[]> =>
      repositorio.historialPrecios(idVariante),

    // N-02: el SP cierra la versión vigente e inserta la nueva en una transacción.
    cambiarPrecio: (idVariante: number, datos: CambiarPrecio): Promise<VersionPrecio[]> =>
      reportes.tras(repositorio.cambiarPrecio(idVariante, datos), 'carritos'),
  };
}

export type CatalogoService = ReturnType<typeof crearCatalogoService>;
