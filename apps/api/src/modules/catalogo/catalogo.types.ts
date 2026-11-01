export interface CategoriaPublica {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
}

export interface Categoria extends CategoriaPublica {
  activo: boolean;
}
