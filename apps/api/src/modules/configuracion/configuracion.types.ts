import type { Decimal } from 'decimal.js';

/** A-14: los parámetros del sistema (la fila única de ParametroSistema). */
export interface Configuracion {
  diasGarantiaPrecio: number;
  minutosReserva: number;
  horasCarritoAbandonado: number;
  diasExpiracionCarritoInvitado: number;
  umbralUltimasUnidades: number;
  /** N-04: null = sin envío gratis. */
  montoEnvioGratis: Decimal | null;
  maxIntentosPagoRechazados: number;
  diasPlazoDevolucion: number;
  maxLineasCarrito: number;
  fechaActualizacion: Date;
}
