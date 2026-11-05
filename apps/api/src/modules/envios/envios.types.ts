import type { Decimal } from 'decimal.js';

/** N-04: un método de envío con su costo para el carrito de quien pregunta. */
export interface MetodoEnvioParaCarrito {
  idMetodoEnvio: number;
  codigo: string;
  nombre: string;
  diasMin: number;
  diasMax: number;
  tarifa: Decimal;
  /** La tarifa, o 0 si el carrito alcanzó el envío gratis. */
  costo: Decimal;
  envioGratis: boolean;
  /** M4-H02: el total del carrito después del cupón más `costo`, calculado en el SP. */
  totalConEnvio: Decimal;
}

/** N-04: null si la tienda no tiene envío gratis. */
export interface EnvioGratis {
  montoMinimo: Decimal;
  faltante: Decimal;
  alcanzado: boolean;
}

export interface MetodosParaCarrito {
  metodos: MetodoEnvioParaCarrito[];
  /** M4-H02: MinutosReserva de ParametroSistema, lo que dura la reserva al iniciar el pago. */
  minutosReserva: number;
  envioGratis: EnvioGratis | null;
}

export interface MetodoEnvio {
  idMetodoEnvio: number;
  codigo: string;
  nombre: string;
  costo: Decimal;
  diasMin: number;
  diasMax: number;
  activo: boolean;
}
