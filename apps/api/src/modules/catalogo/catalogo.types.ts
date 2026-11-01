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
