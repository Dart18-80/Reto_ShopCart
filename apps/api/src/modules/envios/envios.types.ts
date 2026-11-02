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
}

/** N-04: null si la tienda no tiene envío gratis. */
export interface EnvioGratis {
  montoMinimo: Decimal;
  faltante: Decimal;
  alcanzado: boolean;
}

export interface MetodosParaCarrito {
  metodos: MetodoEnvioParaCarrito[];
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
