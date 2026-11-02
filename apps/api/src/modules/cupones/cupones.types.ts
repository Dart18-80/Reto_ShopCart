import type { Decimal } from 'decimal.js';

export const TIPOS_CUPON = ['Porcentaje', 'MontoFijo'] as const;
export type TipoCupon = (typeof TIPOS_CUPON)[number];

export interface Cupon {
  idCupon: number;
  codigo: string;
  descripcion: string;
  tipo: TipoCupon;
  valor: Decimal;
  /** Tope del descuento de un cupón de porcentaje (N-12). */
  montoMaximoDescuento: Decimal | null;
  montoMinimoCompra: Decimal;
  /** null: aplica a todo el carrito. */
  categoria: { idCategoria: number; nombre: string } | null;
  fechaInicio: Date;
  fechaFin: Date;
  limiteUsosTotal: number;
  limiteUsosPorCliente: number;
  /** Reservados + confirmados (A-13). */
  usosComprometidos: number;
  /** N-12: con usos, su tipo y su valor ya no cambian. */
  usado: boolean;
  activo: boolean;
}

/** Los valores de un cupón nuevo, como los recibe el SP. */
export interface DatosCupon {
  codigo: string;
  descripcion: string;
  tipo: TipoCupon;
  valor: Decimal;
  montoMaximoDescuento: Decimal | null;
  montoMinimoCompra: Decimal;
  idCategoria: number | null;
  fechaInicio: Date;
  fechaFin: Date;
  limiteUsosTotal: number;
  limiteUsosPorCliente: number;
  activo: boolean;
}
