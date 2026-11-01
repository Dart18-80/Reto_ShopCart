import { AppError } from '../../shared/errors/index.js';
import { paginar, type RespuestaPaginada } from '../../shared/http/index.js';
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
  FiltrosProductos,
  ProductoAdmin,
  ProductoResumen,
  ProductoTienda,
  ValorAtributoCreado,
  VersionPrecio,
} from './catalogo.types.js';

interface Dependencias {
  repositorio: CatalogoRepository;
}

function existente<T>(producto: T | null): T {
  if (producto === null) throw new AppError('NO_ENCONTRADO', { mensaje: 'El producto no existe.' });
  return producto;
}

// N-14: las reglas del catálogo (nombres únicos, categoría activa, conjunto de atributos, combinación y
// SKU únicos, historial) las garantiza el SP bajo bloqueo; el servicio solo orquesta.
export function crearCatalogoService({ repositorio }: Dependencias) {
  return {
    listarCategorias: (): Promise<CategoriaPublica[]> => repositorio.listarCategorias(),

    crearCategoria: (datos: CrearCategoria): Promise<Categoria> =>
      repositorio.crearCategoria(datos),

    actualizarCategoria: (id: number, cambios: ActualizarCategoria): Promise<Categoria> =>
      repositorio.actualizarCategoria(id, cambios),

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

    async listarProductosAdmin(
      filtros: FiltrosProductos,
    ): Promise<RespuestaPaginada<ProductoResumen>> {
      const { productos, total } = await repositorio.listarProductosAdmin(filtros);
      return paginar(productos, total, filtros);
    },

    obtenerProductoAdmin: async (id: number): Promise<ProductoAdmin> =>
      existente(await repositorio.obtenerProductoAdmin(id)),

    // N-06: un producto inactivo o sin variantes activas no existe para la tienda (404).
    obtenerProductoTienda: async (id: number): Promise<ProductoTienda> =>
      existente(await repositorio.obtenerProductoTienda(id)),

    crearProducto: (datos: CrearProducto): Promise<ProductoAdmin> =>
      repositorio.crearProducto(datos),

    actualizarProducto: (id: number, cambios: ActualizarProducto): Promise<ProductoAdmin> =>
      repositorio.actualizarProducto(id, cambios),

    activarProducto: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoProducto(id, true),

    desactivarProducto: (id: number): Promise<ProductoAdmin> =>
      repositorio.cambiarEstadoProducto(id, false),

    eliminarProducto: (id: number): Promise<void> => repositorio.eliminarProducto(id),

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

    eliminarVariante: (id: number): Promise<void> => repositorio.eliminarVariante(id),

    historialPrecios: (idVariante: number): Promise<VersionPrecio[]> =>
      repositorio.historialPrecios(idVariante),

    // N-02: el SP cierra la versión vigente e inserta la nueva en una transacción.
    cambiarPrecio: (idVariante: number, datos: CambiarPrecio): Promise<VersionPrecio[]> =>
      repositorio.cambiarPrecio(idVariante, datos),
  };
}

export type CatalogoService = ReturnType<typeof crearCatalogoService>;
