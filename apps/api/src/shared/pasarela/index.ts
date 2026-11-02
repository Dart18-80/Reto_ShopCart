import type { Decimal } from 'decimal.js';

const MARCAS: Readonly<Record<string, string>> = { '3': 'Amex', '4': 'Visa', '5': 'Mastercard' };
const DIGITOS_VISIBLES = 4;

/** La marca por el primer dígito del número (lo único que, con los últimos 4, se guarda de la tarjeta). */
export const marcaDeTarjeta = (numero: string): string => MARCAS[numero.charAt(0)] ?? 'Otra';

export const ultimosDigitos = (numero: string): string => numero.slice(-DIGITOS_VISIBLES);

/** Los datos de la tarjeta solo viajan a la pasarela: nunca se guardan ni se registran (N-03). */
export interface TarjetaPago {
  numero: string;
  mesVencimiento: number;
  anioVencimiento: number;
  cvv: string;
}

export interface SolicitudAutorizacion {
  /** La llave de idempotencia del intento: la misma llave recibe siempre la misma respuesta. */
  llave: string;
  monto: Decimal;
  tarjeta: TarjetaPago;
}

interface DatosTarjeta {
  marca: string;
  ultimosDigitos: string;
}

export type ResultadoAutorizacion =
  | ({ tipo: 'Autorizada'; idTransaccion: string } & DatosTarjeta)
  | ({ tipo: 'Rechazada'; codigo: string; mensaje: string } & DatosTarjeta);

/** N-03: lo que la pasarela sabe de una llave, para la conciliación. */
export type EstadoEnPasarela =
  | { estado: 'NoExiste' }
  | ({ estado: 'Autorizada' | 'Capturada' | 'Anulada'; idTransaccion: string } & DatosTarjeta)
  | ({ estado: 'Rechazada'; codigo: string; mensaje: string } & DatosTarjeta);

/**
 * La pasarela no respondió (timeout o red): no se sabe si autorizó. Nunca se crea un pedido así; el
 * reintento con la misma llave (o la conciliación) lo resuelve.
 */
export class PasarelaSinRespuesta extends Error {
  constructor(operacion: string, opciones?: ErrorOptions) {
    super(`La pasarela no respondió a ${operacion}`, opciones);
    this.name = 'PasarelaSinRespuesta';
  }
}

/** Puerto (N-03): un adaptador por pasarela; la simulada está en shared/adapters. */
export interface PasarelaPago {
  /** Lanza PasarelaSinRespuesta si no se sabe el resultado. */
  autorizar(solicitud: SolicitudAutorizacion): Promise<ResultadoAutorizacion>;
  /** Idempotente: capturar dos veces la misma autorización no cobra dos veces. */
  capturar(idTransaccion: string): Promise<void>;
  /** Idempotente. */
  anular(idTransaccion: string): Promise<void>;
  /** Idempotente por llave; nunca reembolsa más de lo capturado. */
  reembolsar(solicitud: {
    llave: string;
    idTransaccion: string;
    monto: Decimal;
  }): Promise<{ idReembolso: string }>;
  consultar(llave: string): Promise<EstadoEnPasarela>;
}
