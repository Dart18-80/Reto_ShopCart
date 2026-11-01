export interface Movimiento {
  idMovimientoKardex: number;
  idVariante: number;
  tipo: string;
  signo: number;
  cantidad: number;
  existenciaAnterior: number;
  existenciaResultante: number;
  motivo: string;
  referencia: string | null;
  idPedido: number | null;
  idDevolucion: number | null;
  usuario: { idUsuario: number; nombre: string };
  fecha: Date;
}

export interface Existencia {
  idVariante: number;
  sku: string;
  idProducto: number;
  producto: string;
  descripcionAtributos: string;
  activo: boolean;
  existenciaFisica: number;
  reservado: number;
  disponible: number;
}

/** Una variante cuya existencia física no cuadra con el kardex (N-07: no debería haber ninguna). */
export interface Descuadre {
  idVariante: number;
  sku: string;
  existenciaFisica: number;
  sumaKardex: number;
  existenciaUltimoMovimiento: number | null;
}

export interface ExistenciaBodega {
  idVariante: number;
  sku: string;
  existenciaFisica: number;
  unidadesPorDespachar: number;
  existenciaBodega: number;
}

export interface Pagina {
  pagina: number;
  tamano: number;
}
