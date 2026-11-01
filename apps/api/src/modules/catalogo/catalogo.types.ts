import type { Decimal } from 'decimal.js';

export interface CategoriaPublica {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
}

export interface Categoria extends CategoriaPublica {
  activo: boolean;
}

export interface ValorAtributo {
  idValorAtributo: number;
  valor: string;
  orden: number;
}

export interface ValorAtributoCreado extends ValorAtributo {
  idAtributo: number;
}

export interface Atributo {
  idAtributo: number;
  nombre: string;
  orden: number;
  valores: ValorAtributo[];
}

export interface ImagenProducto {
  idImagenProducto: number;
  url: string;
  textoAlternativo: string;
  orden: number;
  esPrincipal: boolean;
}

/** Un valor de la combinación de una variante, con su atributo. */
export interface ValorDeVariante {
  idAtributo: number;
  atributo: string;
  idValorAtributo: number;
  valor: string;
}

export interface VarianteAdmin {
  idVariante: number;
  sku: string;
  descripcionAtributos: string;
  activo: boolean;
  precio: Decimal | null;
  existenciaFisica: number;
  reservado: number;
  disponible: number;
  valores: ValorDeVariante[];
}

export interface ProductoAdmin {
  idProducto: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  imagenes: ImagenProducto[];
  variantes: VarianteAdmin[];
}

export const ESTADOS_EXISTENCIA = ['Disponible', 'UltimasUnidades', 'Agotado'] as const;
export type EstadoExistencia = (typeof ESTADOS_EXISTENCIA)[number];

/** N-06: en la tienda, las unidades restantes solo existen en el estado UltimasUnidades. */
export interface VarianteTienda {
  idVariante: number;
  sku: string;
  descripcionAtributos: string;
  precio: Decimal;
  estadoExistencia: EstadoExistencia;
  unidadesRestantes: number | null;
  valores: ValorDeVariante[];
}

export interface ProductoTienda {
  idProducto: number;
  idCategoria: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  imagenes: ImagenProducto[];
  variantes: VarianteTienda[];
}

export interface ProductoResumen {
  idProducto: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  activo: boolean;
  variantes: number;
  variantesActivas: number;
}

export interface VersionPrecio {
  idPrecioVariante: number;
  precio: Decimal;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
  usuario: { idUsuario: number; nombre: string };
}

export const ORDENES_BUSQUEDA = ['relevancia', 'precio', 'nombre', 'recientes'] as const;
export const DIRECCIONES_ORDEN = ['asc', 'desc'] as const;

export interface FiltrosBusqueda {
  pagina: number;
  tamano: number;
  texto: string | null;
  idCategoria: number | null;
  precioMin: Decimal | null;
  precioMax: Decimal | null;
  disponible: boolean | null;
  orden: (typeof ORDENES_BUSQUEDA)[number];
  direccion: (typeof DIRECCIONES_ORDEN)[number];
}

/** Un producto en los resultados de la tienda: sin existencia, solo si hay disponible (N-06). */
export interface ProductoBusqueda {
  idProducto: number;
  nombre: string;
  idCategoria: number;
  categoria: string;
  precioMinimo: Decimal;
  disponible: boolean;
  imagenPrincipal: string | null;
}

export interface FiltrosProductos {
  pagina: number;
  tamano: number;
  idCategoria: number | null;
  activo: boolean | null;
  texto: string | null;
}
