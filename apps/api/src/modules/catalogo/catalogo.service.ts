import type { CatalogoRepository } from './catalogo.repository.js';
import type { ActualizarCategoria, CrearCategoria } from './catalogo.schemas.js';
import type { Categoria, CategoriaPublica } from './catalogo.types.js';

interface Dependencias {
  repositorio: CatalogoRepository;
}

// N-14: las reglas de categorías (nombre único, sin productos activos al desactivar, sin productos al
// borrar) las garantiza el SP bajo bloqueo; el servicio solo orquesta.
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
  };
}

export type CatalogoService = ReturnType<typeof crearCatalogoService>;
