import type { Decimal } from 'decimal.js';
import type { Pedido } from '../pedidos/index.js';

/** N-02: lo que se cobra por línea, congelado al iniciar el pago. */
export interface LineaSesion {
  idVariante: number;
  idProducto: number;
  producto: string;
  sku: string;
  descripcionAtributos: string;
  cantidad: number;
  precioUnitario: Decimal;
  descuentoLinea: Decimal;
  totalLinea: Decimal;
}

/** RF-06: la sesión de pago Activa del cliente, con la dirección y los montos copiados (M-04). */
export interface SesionPago {
  idSesion: number;
  expiraEn: Date;
  direccion: {
    nombreRecibe: string;
    telefonoRecibe: string;
    idMunicipio: number;
    municipio: string;
    departamento: string;
    direccionLinea: string;
    referencia: string | null;
  };
  envio: {
    idMetodoEnvio: number;
    nombre: string;
    diasMin: number;
    diasMax: number;
    costo: Decimal;
  };
  codigoCupon: string | null;
  lineas: LineaSesion[];
  subtotal: Decimal;
  descuento: Decimal;
  total: Decimal;
  intentosRechazados: number;
}

export interface SesionIniciada {
  sesion: SesionPago;
  /** false si se reutilizó la sesión Activa porque el contenido no cambió (la API responde 200). */
  creada: boolean;
}

export interface DatosInicioPago {
  idDireccion: number;
  idMetodoEnvio: number;
}

/** N-03: lo que el candado de idempotencia decide (SP_Checkout_RegistrarIntentoPago). */
export type RegistroIntento =
  | { accion: 'Autorizar'; idIntento: number; monto: Decimal }
  | { accion: 'CrearPedido'; idIntento: number; idTransaccion: string }
  | { accion: 'Capturar'; idIntento: number; idTransaccion: string; idPedido: number }
  | { accion: 'Pedido'; idPedido: number }
  | { accion: 'EnCurso'; segundosParaReintentar: number }
  | { accion: 'Rechazado'; mensaje: string; intentosRestantes: number }
  | { accion: 'Error'; codigo: string; mensaje: string | null };

export type CambioIntento =
  | { estado: 'Autorizado'; idTransaccion: string }
  | { estado: 'Rechazado'; codigo: string; mensaje: string }
  | { estado: 'Anulado'; codigo: string; mensaje: string | null }
  | { estado: 'Capturado' };

export interface PagoRealizado {
  pedido: Pedido;
  /** false si el pedido ya existía (misma llave o sesión ya pagada): la API responde 200. */
  creado: boolean;
}

/** N-03 (E5-H04): un intento en curso abandonado que la conciliación tomó. */
export interface IntentoPorConciliar {
  idIntento: number;
  estado: 'Pendiente' | 'Autorizado';
  llave: string;
  idTransaccion: string | null;
  /** El pedido creado con este intento, si existe. */
  idPedido: number | null;
}

/** ejecutada = false si la otra réplica tenía el sp_getapplock; intento null si no queda ninguno. */
export type TomaConciliacion =
  { ejecutada: false } | { ejecutada: true; intento: IntentoPorConciliar | null };

export type ResolucionConciliada =
  | { estado: 'Fallido' }
  | { estado: 'Rechazado'; codigo: string; mensaje: string }
  | { estado: 'Anulado' | 'Capturado'; idTransaccion: string };
