import { describe, expect, it, vi } from 'vitest';
import type { CatalogoRepository } from '../../../../src/modules/catalogo/catalogo.repository.js';
import { crearCatalogoService } from '../../../../src/modules/catalogo/catalogo.service.js';
import type { Categoria } from '../../../../src/modules/catalogo/catalogo.types.js';

const CATEGORIA: Categoria = { idCategoria: 4, nombre: 'Camisas', descripcion: null, activo: true };

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
