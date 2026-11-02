import type { Decimal } from 'decimal.js';

export interface LineaPedido {
  idVariante: number;
  sku: string;
  producto: string;
  descripcionVariante: string;
  categoria: string;
  cantidad: number;
  precioUnitario: Decimal;
  descuentoLinea: Decimal;
  totalLinea: Decimal;
}

/** RF-06, M-04: el pedido con las copias congeladas al confirmar el pago. */
export interface Pedido {
  idPedido: number;
  numeroPedido: string;
  estado: string;
  subtotal: Decimal;
  descuento: Decimal;
  costoEnvio: Decimal;
  total: Decimal;
  /** N-18: base imponible e IVA del total (precios con IVA incluido). */
  baseImponible: Decimal;
  iva: Decimal;
  codigoCupon: string | null;
  envio: { nombre: string; fechaEstimadaEntrega: string };
  fechaPago: Date;
  /** A-12: el día de Guatemala (YYYY-MM-DD). */
  fechaPagoLocal: string;
  tarjeta: { marca: string; ultimosDigitos: string };
  direccion: {
    nombreRecibe: string;
    telefonoRecibe: string;
    departamento: string;
    municipio: string;
    direccionLinea: string;
    referencia: string | null;
  };
  lineas: LineaPedido[];
}
