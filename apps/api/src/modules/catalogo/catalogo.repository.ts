import sql from 'mssql';
import { ejecutarSP } from '../../shared/db/index.js';
import type {
  ActualizarCategoria,
  CrearAtributo,
  CrearCategoria,
  CrearValorAtributo,
} from './catalogo.schemas.js';
import type {
  Atributo,
  Categoria,
  CategoriaPublica,
  ValorAtributoCreado,
} from './catalogo.types.js';

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

interface FilaAtributo {
  IDAtributo: number;
  Nombre: string;
  Orden: number;
}

// SP_Catalogo_ListarAtributos: una fila por valor; un atributo sin valores trae el valor en NULL.
interface FilaAtributoConValor extends FilaAtributo {
  IDValorAtributo: number | null;
  Valor: string | null;
  OrdenValor: number | null;
}

interface FilaValorAtributo {
  IDValorAtributo: number;
  IDAtributo: number;
  Valor: string;
  Orden: number;
}

const aAtributoSinValores = (fila: FilaAtributo): Atributo => ({
  idAtributo: fila.IDAtributo,
  nombre: fila.Nombre,
  orden: fila.Orden,
  valores: [],
});

// El Map conserva el orden de inserción, que es el orden en que el SP devuelve las filas.
function agruparAtributos(filas: FilaAtributoConValor[]): Atributo[] {
  const porId = new Map<number, Atributo>();
  for (const fila of filas) {
    const atributo = porId.get(fila.IDAtributo) ?? aAtributoSinValores(fila);
    porId.set(fila.IDAtributo, atributo);
    if (fila.IDValorAtributo === null || fila.Valor === null || fila.OrdenValor === null) continue;
    atributo.valores.push({
      idValorAtributo: fila.IDValorAtributo,
      valor: fila.Valor,
      orden: fila.OrdenValor,
    });
  }
  return [...porId.values()];
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

  async listarAtributos(): Promise<Atributo[]> {
    return agruparAtributos(await ejecutarSP<FilaAtributoConValor>('SP_Catalogo_ListarAtributos'));
  },

  async crearAtributo(datos: CrearAtributo): Promise<Atributo> {
    const [fila] = await ejecutarSP<FilaAtributo>('SP_Catalogo_CrearAtributo', {
      Nombre: { tipo: sql.NVarChar(50), valor: datos.nombre },
      Orden: { tipo: sql.SmallInt, valor: datos.orden ?? null },
    });
    if (fila === undefined) throw new Error('SP_Catalogo_CrearAtributo no devolvió el atributo');
    return aAtributoSinValores(fila);
  },

  async crearValorAtributo(
    idAtributo: number,
    datos: CrearValorAtributo,
  ): Promise<ValorAtributoCreado> {
    const [fila] = await ejecutarSP<FilaValorAtributo>('SP_Catalogo_CrearValorAtributo', {
      IDAtributo: { tipo: sql.Int, valor: idAtributo },
      Valor: { tipo: sql.NVarChar(50), valor: datos.valor },
      Orden: { tipo: sql.SmallInt, valor: datos.orden ?? null },
    });
    if (fila === undefined) throw new Error('SP_Catalogo_CrearValorAtributo no devolvió el valor');
    return {
      idValorAtributo: fila.IDValorAtributo,
      idAtributo: fila.IDAtributo,
      valor: fila.Valor,
      orden: fila.Orden,
    };
  },
};

export type CatalogoRepository = typeof catalogoRepository;
