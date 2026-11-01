import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogoRepository } from '../../../../src/modules/catalogo/catalogo.repository.js';
import { crearCatalogoService } from '../../../../src/modules/catalogo/catalogo.service.js';
import type {
  Categoria,
  ProductoAdmin,
  ProductoTienda,
} from '../../../../src/modules/catalogo/catalogo.types.js';

const CATEGORIA: Categoria = { idCategoria: 4, nombre: 'Camisas', descripcion: null, activo: true };
const PRODUCTO: ProductoAdmin = {
  idProducto: 8,
  idCategoria: 4,
  categoria: 'Camisas',
  nombre: 'Oxford',
  descripcion: null,
  activo: true,
  imagenes: [],
  variantes: [],
};

function preparar() {
  const repositorio = {
    listarCategorias: vi.fn(() => Promise.resolve([])),
    crearCategoria: vi.fn(() => Promise.resolve(CATEGORIA)),
    actualizarCategoria: vi.fn(() => Promise.resolve(CATEGORIA)),
    cambiarEstadoCategoria: vi.fn((_id: number, activo: boolean) =>
      Promise.resolve({ ...CATEGORIA, activo }),
    ),
    eliminarCategoria: vi.fn(() => Promise.resolve()),
    listarAtributos: vi.fn(() => Promise.resolve([])),
    crearAtributo: vi.fn(() =>
      Promise.resolve({ idAtributo: 2, nombre: 'Talla', orden: 1, valores: [] }),
    ),
    crearValorAtributo: vi.fn(() =>
      Promise.resolve({ idValorAtributo: 9, idAtributo: 2, valor: 'M', orden: 1 }),
    ),
    buscarProductos: vi.fn(() => Promise.resolve({ productos: [], total: 0 })),
    listarProductosAdmin: vi.fn(() => Promise.resolve({ productos: [], total: 0 })),
    obtenerProductoAdmin: vi.fn((): Promise<ProductoAdmin | null> => Promise.resolve(null)),
    obtenerProductoTienda: vi.fn((): Promise<ProductoTienda | null> => Promise.resolve(null)),
    crearProducto: vi.fn(() => Promise.resolve(PRODUCTO)),
    actualizarProducto: vi.fn(() => Promise.resolve(PRODUCTO)),
    cambiarEstadoProducto: vi.fn((_id: number, _activo: boolean) => Promise.resolve(PRODUCTO)),
    eliminarProducto: vi.fn(() => Promise.resolve()),
    guardarImagenes: vi.fn(() => Promise.resolve(PRODUCTO)),
    crearVariante: vi.fn(() => Promise.resolve(PRODUCTO)),
    actualizarVariante: vi.fn(() => Promise.resolve(PRODUCTO)),
    cambiarEstadoVariante: vi.fn((_id: number, _activo: boolean) => Promise.resolve(PRODUCTO)),
    eliminarVariante: vi.fn(() => Promise.resolve()),
    historialPrecios: vi.fn(() => Promise.resolve([])),
    cambiarPrecio: vi.fn(() => Promise.resolve([])),
  } satisfies CatalogoRepository;
  return { servicio: crearCatalogoService({ repositorio }), repositorio };
}

describe('catalogo.service: categorías (E3-H01, N-14)', () => {
  it('activar y desactivar llegan al SP de cambio de estado con el estado pedido', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.desactivarCategoria(4);
    await servicio.activarCategoria(4);

    expect(repositorio.cambiarEstadoCategoria.mock.calls).toEqual([
      [4, false],
      [4, true],
    ]);
  });

  it('PATCH pasa al SP solo lo que llegó: la mezcla la hace el SP bajo bloqueo', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.actualizarCategoria(4, { descripcion: null });

    expect(repositorio.actualizarCategoria).toHaveBeenCalledWith(4, { descripcion: null });
  });

  it('un error del SP (por ejemplo, CATEGORIA_CON_PRODUCTOS) llega intacto a quien llama', async () => {
    const { servicio, repositorio } = preparar();
    const rechazo = new Error('CATEGORIA_CON_PRODUCTOS');
    repositorio.eliminarCategoria.mockRejectedValueOnce(rechazo);

    await expect(servicio.eliminarCategoria(4)).rejects.toBe(rechazo);
  });
});

describe('catalogo.service: atributos (E3-H02, N-14)', () => {
  it('un valor se agrega al atributo de la ruta, con el orden opcional tal como llegó', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.crearValorAtributo(2, { valor: 'M' });

    expect(repositorio.crearValorAtributo).toHaveBeenCalledWith(2, { valor: 'M' });
  });
});

describe('catalogo.service: productos y variantes (E3-H03, N-06, N-14)', () => {
  it('un producto que la base no devuelve responde NO_ENCONTRADO, en la tienda y en la administración', async () => {
    const { servicio } = preparar();

    await expect(servicio.obtenerProductoTienda(8)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    await expect(servicio.obtenerProductoAdmin(8)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
  });

  it('activar y desactivar productos y variantes llegan al SP con el estado pedido', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.activarProducto(8);
    await servicio.desactivarVariante(3);

    expect(repositorio.cambiarEstadoProducto).toHaveBeenCalledWith(8, true);
    expect(repositorio.cambiarEstadoVariante).toHaveBeenCalledWith(3, false);
  });

  it('el listado de administración responde con la paginación estándar', async () => {
    const { servicio, repositorio } = preparar();
    repositorio.listarProductosAdmin.mockResolvedValueOnce({ productos: [], total: 41 });

    const respuesta = await servicio.listarProductosAdmin({
      pagina: 2,
      tamano: 20,
      idCategoria: null,
      activo: null,
      texto: null,
    });

    expect(respuesta.paginacion).toEqual({ pagina: 2, tamano: 20, total: 41, totalPaginas: 3 });
  });
});

describe('catalogo.service: precios (E3-H04, N-02)', () => {
  it('el cambio de precio llega al SP de la variante de la ruta con el monto como Decimal', async () => {
    const { servicio, repositorio } = preparar();
    const precio = new Decimal('89.50');

    await servicio.cambiarPrecio(3, { precio });

    expect(repositorio.cambiarPrecio).toHaveBeenCalledWith(3, { precio });
  });
});

describe('catalogo.service: búsqueda (E3-H05)', () => {
  it('pasa los filtros tal como llegaron y responde con la paginación estándar', async () => {
    const { servicio, repositorio } = preparar();
    repositorio.buscarProductos.mockResolvedValueOnce({ productos: [], total: 5 });
    const filtros = {
      pagina: 1,
      tamano: 2,
      texto: 'camion',
      idCategoria: null,
      precioMin: null,
      precioMax: null,
      disponible: true,
      orden: 'precio' as const,
      direccion: 'desc' as const,
    };

    const respuesta = await servicio.buscarProductos(filtros);

    expect(repositorio.buscarProductos).toHaveBeenCalledWith(filtros);
    expect(respuesta.paginacion).toEqual({ pagina: 1, tamano: 2, total: 5, totalPaginas: 3 });
  });
});
