import sql from 'mssql';
import {
  ejecutarSP,
  ejecutarSPConjuntos,
  type NombreSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
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
  EstadoExistencia,
  FiltrosBusqueda,
  FiltrosProductos,
  ImagenProducto,
  ProductoAdmin,
  ProductoBusqueda,
  ProductoResumen,
  ProductoTienda,
  ValorAtributoCreado,
  ValorDeVariante,
  VarianteAdmin,
  VarianteTienda,
  VersionPrecio,
} from './catalogo.types.js';

// --- Categorías

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

// --- Atributos

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

// --- Productos: los SPs de detalle devuelven cuatro conjuntos (producto, imágenes, variantes, valores).

interface FilaProducto {
  IDProducto: number;
  IDCategoria: number;
  Categoria: string;
  Nombre: string;
  Descripcion: string | null;
}

interface FilaProductoAdmin extends FilaProducto {
  Activo: boolean;
}

interface FilaImagen {
  IDImagenProducto: number;
  Url: string;
  TextoAlternativo: string;
  Orden: number;
  EsPrincipal: boolean;
}

interface FilaVariante {
  IDVariante: number;
  SKU: string;
  DescripcionAtributos: string;
}

interface FilaVarianteAdmin extends FilaVariante {
  Activo: boolean;
  Precio: number | null;
  ExistenciaFisica: number;
  Reservado: number;
  Disponible: number;
}

interface FilaVarianteTienda extends FilaVariante {
  Precio: number;
  EstadoExistencia: EstadoExistencia;
  UnidadesRestantes: number | null;
}

interface FilaValorDeVariante {
  IDVariante: number;
  IDAtributo: number;
  Atributo: string;
  IDValorAtributo: number;
  Valor: string;
}

interface FilaProductoResumen {
  IDProducto: number;
  Nombre: string;
  IDCategoria: number;
  Categoria: string;
  Activo: boolean;
  Variantes: number;
  VariantesActivas: number;
  TotalFilas: number;
}

const aImagen = (fila: FilaImagen): ImagenProducto => ({
  idImagenProducto: fila.IDImagenProducto,
  url: fila.Url,
  textoAlternativo: fila.TextoAlternativo,
  orden: fila.Orden,
  esPrincipal: fila.EsPrincipal,
});

function valoresPorVariante(filas: FilaValorDeVariante[]): Map<number, ValorDeVariante[]> {
  const porVariante = new Map<number, ValorDeVariante[]>();
  for (const fila of filas) {
    const valores = porVariante.get(fila.IDVariante) ?? [];
    valores.push({
      idAtributo: fila.IDAtributo,
      atributo: fila.Atributo,
      idValorAtributo: fila.IDValorAtributo,
      valor: fila.Valor,
    });
    porVariante.set(fila.IDVariante, valores);
  }
  return porVariante;
}

interface ConjuntosProducto<P, V> {
  producto: P | undefined;
  imagenes: FilaImagen[];
  variantes: V[];
  valores: FilaValorDeVariante[];
}

async function conjuntosProducto<P, V>(
  nombre: NombreSP,
  parametros: ParametrosSP,
): Promise<ConjuntosProducto<P, V>> {
  const [productos = [], imagenes = [], variantes = [], valores = []] = await ejecutarSPConjuntos<
    [P[], FilaImagen[], V[], FilaValorDeVariante[]]
  >(nombre, parametros);
  return { producto: productos[0], imagenes, variantes, valores };
}

async function productoAdmin(
  nombre: NombreSP,
  parametros: ParametrosSP,
): Promise<ProductoAdmin | null> {
  const conjuntos = await conjuntosProducto<FilaProductoAdmin, FilaVarianteAdmin>(
    nombre,
    parametros,
  );
  const { producto } = conjuntos;
  if (producto === undefined) return null;
  const valores = valoresPorVariante(conjuntos.valores);
  return {
    idProducto: producto.IDProducto,
    idCategoria: producto.IDCategoria,
    categoria: producto.Categoria,
    nombre: producto.Nombre,
    descripcion: producto.Descripcion,
    activo: producto.Activo,
    imagenes: conjuntos.imagenes.map(aImagen),
    variantes: conjuntos.variantes.map((fila): VarianteAdmin => ({
      idVariante: fila.IDVariante,
      sku: fila.SKU,
      descripcionAtributos: fila.DescripcionAtributos,
      activo: fila.Activo,
      precio: fila.Precio === null ? null : aMonto(fila.Precio),
      existenciaFisica: fila.ExistenciaFisica,
      reservado: fila.Reservado,
      disponible: fila.Disponible,
      valores: valores.get(fila.IDVariante) ?? [],
    })),
  };
}

async function productoAdminEscrito(
  nombre: NombreSP,
  parametros: ParametrosSP,
): Promise<ProductoAdmin> {
  const producto = await productoAdmin(nombre, parametros);
  if (producto === null) throw new Error(`${nombre} no devolvió el producto`);
  return producto;
}

interface FilaProductoBusqueda {
  IDProducto: number;
  Nombre: string;
  IDCategoria: number;
  Categoria: string;
  PrecioMinimo: number;
  TieneDisponible: boolean;
  ImagenPrincipal: string | null;
  TotalFilas: number;
}

interface FilaVersionPrecio {
  IDPrecioVariante: number;
  Precio: number;
  VigenteDesde: Date;
  VigenteHasta: Date | null;
  IDUsuario: number;
  Usuario: string;
}

const aVersionPrecio = (fila: FilaVersionPrecio): VersionPrecio => ({
  idPrecioVariante: fila.IDPrecioVariante,
  precio: aMonto(fila.Precio),
  vigenteDesde: fila.VigenteDesde,
  vigenteHasta: fila.VigenteHasta,
  usuario: { idUsuario: fila.IDUsuario, nombre: fila.Usuario },
});

const idProducto = (id: number) => ({ IDProducto: { tipo: sql.Int, valor: id } });
const idVariante = (id: number) => ({ IDVariante: { tipo: sql.Int, valor: id } });
// A-22: las listas viajan al SP como JSON.
const comoJson = (lista: unknown[]) => ({
  tipo: sql.NVarChar(sql.MAX),
  valor: JSON.stringify(lista),
});

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

  async buscarProductos(
    filtros: FiltrosBusqueda,
  ): Promise<{ productos: ProductoBusqueda[]; total: number }> {
    const filas = await ejecutarSP<FilaProductoBusqueda>('SP_Catalogo_BuscarProductos', {
      Texto: { tipo: sql.NVarChar(150), valor: filtros.texto },
      IDCategoria: { tipo: sql.Int, valor: filtros.idCategoria },
      PrecioMin: { tipo: sql.Decimal(12, 2), valor: filtros.precioMin },
      PrecioMax: { tipo: sql.Decimal(12, 2), valor: filtros.precioMax },
      Disponible: { tipo: sql.Bit, valor: filtros.disponible },
      Orden: { tipo: sql.VarChar(20), valor: filtros.orden },
      Direccion: { tipo: sql.VarChar(4), valor: filtros.direccion },
      Pagina: { tipo: sql.Int, valor: filtros.pagina },
      Tamano: { tipo: sql.Int, valor: filtros.tamano },
    });
    const productos = filas.map((fila): ProductoBusqueda => ({
      idProducto: fila.IDProducto,
      nombre: fila.Nombre,
      idCategoria: fila.IDCategoria,
      categoria: fila.Categoria,
      precioMinimo: aMonto(fila.PrecioMinimo),
      disponible: fila.TieneDisponible,
      imagenPrincipal: fila.ImagenPrincipal,
    }));
    return { productos, total: filas[0]?.TotalFilas ?? 0 };
  },

  async listarProductosAdmin(
    filtros: FiltrosProductos,
  ): Promise<{ productos: ProductoResumen[]; total: number }> {
    const filas = await ejecutarSP<FilaProductoResumen>('SP_Catalogo_ListarProductosAdmin', {
      Pagina: { tipo: sql.Int, valor: filtros.pagina },
      Tamano: { tipo: sql.Int, valor: filtros.tamano },
      IDCategoria: { tipo: sql.Int, valor: filtros.idCategoria },
      Activo: { tipo: sql.Bit, valor: filtros.activo },
      Texto: { tipo: sql.NVarChar(150), valor: filtros.texto },
    });
    const productos = filas.map((fila): ProductoResumen => ({
      idProducto: fila.IDProducto,
      nombre: fila.Nombre,
      idCategoria: fila.IDCategoria,
      categoria: fila.Categoria,
      activo: fila.Activo,
      variantes: fila.Variantes,
      variantesActivas: fila.VariantesActivas,
    }));
    return { productos, total: filas[0]?.TotalFilas ?? 0 };
  },

  obtenerProductoAdmin: (id: number): Promise<ProductoAdmin | null> =>
    productoAdmin('SP_Catalogo_ObtenerProductoAdmin', idProducto(id)),

  async obtenerProductoTienda(id: number): Promise<ProductoTienda | null> {
    const conjuntos = await conjuntosProducto<FilaProducto, FilaVarianteTienda>(
      'SP_Catalogo_ObtenerProducto',
      idProducto(id),
    );
    const { producto } = conjuntos;
    if (producto === undefined) return null;
    const valores = valoresPorVariante(conjuntos.valores);
    return {
      idProducto: producto.IDProducto,
      idCategoria: producto.IDCategoria,
      categoria: producto.Categoria,
      nombre: producto.Nombre,
      descripcion: producto.Descripcion,
      imagenes: conjuntos.imagenes.map(aImagen),
      variantes: conjuntos.variantes.map((fila): VarianteTienda => ({
        idVariante: fila.IDVariante,
        sku: fila.SKU,
        descripcionAtributos: fila.DescripcionAtributos,
        precio: aMonto(fila.Precio),
        estadoExistencia: fila.EstadoExistencia,
        unidadesRestantes: fila.UnidadesRestantes,
        valores: valores.get(fila.IDVariante) ?? [],
      })),
    };
  },

  crearProducto: (datos: CrearProducto): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_CrearProducto', {
      IDCategoria: { tipo: sql.Int, valor: datos.idCategoria },
      Nombre: { tipo: sql.NVarChar(150), valor: datos.nombre },
      Descripcion: { tipo: sql.NVarChar(2000), valor: datos.descripcion ?? null },
      Activo: { tipo: sql.Bit, valor: datos.activo },
    }),

  // PATCH: un campo ausente va en NULL (sin cambio) y descripcion en null la quita.
  actualizarProducto: (id: number, cambios: ActualizarProducto): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_ActualizarProducto', {
      ...idProducto(id),
      IDCategoria: { tipo: sql.Int, valor: cambios.idCategoria ?? null },
      Nombre: { tipo: sql.NVarChar(150), valor: cambios.nombre ?? null },
      Descripcion: { tipo: sql.NVarChar(2000), valor: cambios.descripcion ?? null },
      QuitarDescripcion: { tipo: sql.Bit, valor: cambios.descripcion === null },
    }),

  cambiarEstadoProducto: (id: number, activo: boolean): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_CambiarEstadoProducto', {
      ...idProducto(id),
      Activo: { tipo: sql.Bit, valor: activo },
    }),

  async eliminarProducto(id: number): Promise<void> {
    await ejecutarSP('SP_Catalogo_EliminarProducto', idProducto(id));
  },

  guardarImagenes: (id: number, datos: GuardarImagenes): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_GuardarImagenes', {
      ...idProducto(id),
      Imagenes: comoJson(datos.imagenes),
    }),

  crearVariante: (id: number, datos: CrearVariante): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_CrearVariante', {
      ...idProducto(id),
      SKU: { tipo: sql.VarChar(40), valor: datos.sku },
      Valores: comoJson(datos.valores),
      Precio: { tipo: sql.Decimal(12, 2), valor: datos.precio },
    }),

  // PATCH: un campo ausente va en NULL (sin cambio).
  actualizarVariante: (id: number, cambios: ActualizarVariante): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_ActualizarVariante', {
      ...idVariante(id),
      SKU: { tipo: sql.VarChar(40), valor: cambios.sku ?? null },
      Valores:
        cambios.valores === undefined
          ? { tipo: sql.NVarChar(sql.MAX), valor: null }
          : comoJson(cambios.valores),
    }),

  cambiarEstadoVariante: (id: number, activo: boolean): Promise<ProductoAdmin> =>
    productoAdminEscrito('SP_Catalogo_CambiarEstadoVariante', {
      ...idVariante(id),
      Activo: { tipo: sql.Bit, valor: activo },
    }),

  async eliminarVariante(id: number): Promise<void> {
    await ejecutarSP('SP_Catalogo_EliminarVariante', idVariante(id));
  },

  async historialPrecios(id: number): Promise<VersionPrecio[]> {
    const filas = await ejecutarSP<FilaVersionPrecio>(
      'SP_Catalogo_HistorialPrecios',
      idVariante(id),
    );
    return filas.map(aVersionPrecio);
  },

  async cambiarPrecio(id: number, datos: CambiarPrecio): Promise<VersionPrecio[]> {
    const filas = await ejecutarSP<FilaVersionPrecio>('SP_Catalogo_CambiarPrecio', {
      ...idVariante(id),
      Precio: { tipo: sql.Decimal(12, 2), valor: datos.precio },
    });
    return filas.map(aVersionPrecio);
  },
};

export type CatalogoRepository = typeof catalogoRepository;
