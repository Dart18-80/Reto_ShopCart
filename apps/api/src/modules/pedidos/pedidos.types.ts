import type { Decimal } from 'decimal.js';

/** N-08: los estados del pedido (EstadoPedido.Codigo). */
export const ESTADOS_PEDIDO = [
  'Pagado',
  'EnPreparacion',
  'Despachado',
  'Entregado',
  'Cancelado',
  'DevueltoParcial',
  'Devuelto',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export interface LineaPedido {
  idDetallePedido: number;
  idVariante: number;
  sku: string;
  producto: string;
  descripcionVariante: string;
  categoria: string;
  cantidad: number;
  /** N-10: lo ya devuelto de esta línea. */
  cantidadDevuelta: number;
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
  montoReembolsado: Decimal;
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
  /** N-08: (ninguno) → Pagado y cada cambio posterior, en orden. */
  historial: CambioDeEstado[];
}

export interface CambioDeEstado {
  estadoAnterior: string | null;
  estadoNuevo: string;
  /** El rol de quien hizo el cambio (el cliente no ve quién fue). */
  rol: string;
  motivo: string | null;
  fecha: Date;
}

/** RF-07: un pedido en un listado. */
export interface ResumenPedido {
  idPedido: number;
  numeroPedido: string;
  estado: string;
  total: Decimal;
  articulos: number;
  fechaPago: Date;
  fechaPagoLocal: string;
}

/** RF-07: un pedido en la gestión, con su cliente. */
export interface ResumenPedidoGestion extends ResumenPedido {
  cliente: { idUsuario: number; nombre: string; correo: string };
}
