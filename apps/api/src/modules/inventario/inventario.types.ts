// N-07: los tipos de movimiento del kardex (S001).
export const TIPOS_MOVIMIENTO = [
  'EntradaCompra',
  'SalidaVenta',
  'AjustePositivo',
  'AjusteNegativo',
  'ReingresoCancelacion',
  'ReingresoDevolucion',
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export interface Movimiento {
  idMovimientoKardex: number;
  idVariante: number;
  tipo: TipoMovimiento;
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

/** M7-H01: una variante, o el texto que se busca en el producto y en el SKU. */
export interface FiltrosExistencias {
  idVariante: number | null;
  texto: string | null;
}
