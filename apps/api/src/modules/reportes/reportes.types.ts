import type { Decimal } from 'decimal.js';

/** RF-08: el rango de días de Guatemala que el SP efectivamente usó (por defecto, los últimos 30). */
export interface Rango {
  desde: string;
  hasta: string;
}

export interface Resumen extends Rango {
  /** N-11: productos con IVA, sin envío, menos las devoluciones en su propia fecha. */
  ventas: Decimal;
  pedidos: number;
  ticketPromedio: Decimal;
  unidades: number;
  devoluciones: Decimal;
  envio: Decimal;
  carritosAbandonados: number;
  montoPotencialPerdido: Decimal;
}

export interface VentasDelPeriodo {
  /** El primer día del periodo (el día, el lunes de la semana o el primero del mes). */
  periodo: string;
  ventas: Decimal;
  pedidos: number;
}

export interface VentasDeCategoria {
  idCategoria: number;
  categoria: string;
  unidades: number;
  ventas: Decimal;
}

export interface ProductoVendido {
  idProducto: number;
  producto: string;
  unidades: number;
  ventas: Decimal;
}

export interface CarritoAbandonado {
  idCarrito: number;
  /** null si es de un invitado. */
  cliente: { idUsuario: number; nombre: string } | null;
  fechaUltimaActividad: Date;
  lineas: number;
  unidades: number;
  montoPotencial: Decimal;
}
