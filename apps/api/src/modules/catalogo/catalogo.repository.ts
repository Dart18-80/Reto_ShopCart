import sql from 'mssql';
import { ejecutarSP } from '../../shared/db/index.js';
import type { ActualizarCategoria, CrearCategoria } from './catalogo.schemas.js';
import type { Categoria, CategoriaPublica } from './catalogo.types.js';

interface FilaCategoriaPublica {
  IDCategoria: number;
  Nombre: string;
  Descripcion: string | null;
}

interface FilaCategoria extends FilaCategoriaPublica {
  Activo: boolean;
}

const aCategoriaPublica = (fila: FilaCategoriaPublica): CategoriaPublica => ({
  idCategoria: fila.IDCategoria,
  nombre: fila.Nombre,
  descripcion: fila.Descripcion,
});

const aCategoria = (fila: FilaCategoria): Categoria => ({
  ...aCategoriaPublica(fila),
  activo: fila.Activo,
});

function unica(filas: FilaCategoria[], sp: string): Categoria {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió la categoría`);
  return aCategoria(fila);
}

const idCategoria = (id: number) => ({ IDCategoria: { tipo: sql.Int, valor: id } });

export const catalogoRepository = {
  async listarCategorias(): Promise<CategoriaPublica[]> {
    const filas = await ejecutarSP<FilaCategoriaPublica>('SP_Catalogo_ListarCategorias');
    return filas.map(aCategoriaPublica);
  },

  async crearCategoria(datos: CrearCategoria): Promise<Categoria> {
    const filas = await ejecutarSP<FilaCategoria>('SP_Catalogo_CrearCategoria', {
      Nombre: { tipo: sql.NVarChar(80), valor: datos.nombre },
      Descripcion: { tipo: sql.NVarChar(300), valor: datos.descripcion ?? null },
    });
    return unica(filas, 'SP_Catalogo_CrearCategoria');
  },

  // PATCH: un campo ausente va en NULL (sin cambio) y descripcion en null la quita; el SP mezcla bajo
  // bloqueo (sqlserver-sp §9.5).
  async actualizarCategoria(id: number, cambios: ActualizarCategoria): Promise<Categoria> {
    const filas = await ejecutarSP<FilaCategoria>('SP_Catalogo_ActualizarCategoria', {
      ...idCategoria(id),
      Nombre: { tipo: sql.NVarChar(80), valor: cambios.nombre ?? null },
      Descripcion: { tipo: sql.NVarChar(300), valor: cambios.descripcion ?? null },
      QuitarDescripcion: { tipo: sql.Bit, valor: cambios.descripcion === null },
    });
    return unica(filas, 'SP_Catalogo_ActualizarCategoria');
  },

  async cambiarEstadoCategoria(id: number, activo: boolean): Promise<Categoria> {
    const filas = await ejecutarSP<FilaCategoria>('SP_Catalogo_CambiarEstadoCategoria', {
      ...idCategoria(id),
      Activo: { tipo: sql.Bit, valor: activo },
    });
    return unica(filas, 'SP_Catalogo_CambiarEstadoCategoria');
  },

  async eliminarCategoria(id: number): Promise<void> {
    await ejecutarSP('SP_Catalogo_EliminarCategoria', idCategoria(id));
  },
};

export type CatalogoRepository = typeof catalogoRepository;
