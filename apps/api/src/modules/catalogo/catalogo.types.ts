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

export interface FiltrosProductos {
  pagina: number;
  tamano: number;
  idCategoria: number | null;
  activo: boolean | null;
  texto: string | null;
}
