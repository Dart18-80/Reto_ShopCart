import type { Decimal } from 'decimal.js';

// RF-05: los tipos viven en @shopcart/shared, con los esquemas de entrada (M9-H01).
import type { TipoCupon } from '@shopcart/shared';

export { TIPOS_CUPON } from '@shopcart/shared';
export type { TipoCupon };

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
