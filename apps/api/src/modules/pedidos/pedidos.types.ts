import type { EstadoPedido, EstadoReembolso, ResolucionPago } from '@shopcart/shared';
import type { Decimal } from 'decimal.js';

// Los estados y las resoluciones viven en @shopcart/shared: la web los usa en sus filtros y formularios.
export { ESTADOS_REEMBOLSO, RESOLUCIONES_PAGO } from '@shopcart/shared';
export type { EstadoPedido, EstadoReembolso, ResolucionPago };

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
/** El cobro de un pedido: EnVerificacion si su intento quedó en revisión manual (V019). */
export const ESTADOS_PAGO = ['Confirmado', 'EnVerificacion'] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export interface Pedido {
  idPedido: number;
  numeroPedido: string;
  estado: string;
  estadoPago: EstadoPago;
  /** M5-H01: si el actor puede cancelarlo ahora (TransicionEstadoPedido para su rol, N-08, N-09). */
  puedeCancelar: boolean;
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

/** M8-H01: una línea vista desde la gestión, con lo que aún se puede devolver (N-10, lo calcula el SP). */
export interface LineaPedidoGestion extends LineaPedido {
  devolvible: number;
}

/**
 * M8-H01: el pedido para el Operador o el Admin, con su cliente y lo que la gestión puede hacer con él ahora
 * (N-08, N-09, N-10). Todo lo calcula SP_Pedidos_ObtenerDetalleGestion: la web no repite reglas.
 */
export interface PedidoGestion extends Omit<Pedido, 'lineas'> {
  cliente: { idUsuario: number; nombre: string; correo: string };
  transicionesPermitidas: EstadoPedido[];
  puedeDevolver: boolean;
  lineas: LineaPedidoGestion[];
}

/** RF-07: un pedido en un listado. */
export interface ResumenPedido {
  idPedido: number;
  numeroPedido: string;
  estado: string;
  estadoPago: EstadoPago;
  total: Decimal;
  articulos: number;
  fechaPago: Date;
  fechaPagoLocal: string;
}

/** RF-07: un pedido en la gestión, con su cliente. */
export interface ResumenPedidoGestion extends ResumenPedido {
  cliente: { idUsuario: number; nombre: string; correo: string };
}

/** E9-H04: un cobro capturado sin pedido se devuelve con un reembolso SinPedido, que apunta al intento. */
export const ORIGENES_REEMBOLSO = ['Cancelacion', 'Devolucion', 'SinPedido'] as const;

export interface Reembolso {
  idReembolso: number;
  idPedido: number | null;
  numeroPedido: string | null;
  idIntentoPago: number | null;
  idDevolucion: number | null;
  origen: (typeof ORIGENES_REEMBOLSO)[number];
  monto: Decimal;
  estado: EstadoReembolso;
  intentos: number;
  ultimoError: string | null;
  idTransaccionReembolso: string | null;
  fechaProximoIntento: Date | null;
  fechaCompletado: Date | null;
  fechaCreacion: Date;
  /** E9-H04: la resolución manual de un Fallido (ResueltoManual). */
  motivoResolucion: string | null;
  referenciaResolucion: string | null;
  fechaResolucion: Date | null;
  /** M8-H05: lo que el Admin puede hacer ahora, con las mismas funciones que exigen los SPs. */
  puedeReintentar: boolean;
  puedeResolver: boolean;
}

export const CAUSAS_REVISION = ['AutorizacionInexistente', 'CobroSinPedido'] as const;

/** Los estados de IntentoPago (CK_IntentoPago_Estado). */
export type EstadoIntentoPago =
  | 'Pendiente'
  | 'Autorizado'
  | 'Capturado'
  | 'Rechazado'
  | 'Anulado'
  | 'Fallido'
  | 'Error'
  | 'EnRevision';

/** Cómo queda un intento tras resolverlo: Capturado si se verificó el cobro; si no, Anulado. */
export const ESTADOS_PAGO_RESUELTO = ['Capturado', 'Anulado'] as const;

export interface PagoEnRevision {
  idIntentoPago: number;
  idPedido: number | null;
  numeroPedido: string | null;
  cliente: { idUsuario: number; nombre: string; correo: string };
  monto: Decimal;
  idTransaccion: string | null;
  tarjeta: { marca: string | null; ultimosDigitos: string | null };
  causa: (typeof CAUSAS_REVISION)[number];
  fecha: Date;
}

/**
 * E9-H04: lo que el servicio necesita antes de resolver a mano un reembolso. Su fecha de actualización es la
 * versión que el SP exige al resolver (concurrencia optimista).
 */
export interface ReembolsoParaResolver {
  estado: EstadoReembolso;
  llave: string;
  /** Para consultar en la pasarela si el cobro se capturó. */
  llaveIntento: string;
  fechaActualizacion: Date;
  /** Con la misma regla y el mismo reloj que los SPs que resuelven: el servicio prevalida, el SP lo exige. */
  plazoCumplido: boolean;
}

/** Lo que el servicio necesita antes de resolver: la llave para consultar la pasarela. */
export interface PagoParaResolver {
  idIntentoPago: number;
  llave: string;
  estado: EstadoIntentoPago;
  idPedido: number | null;
}

export interface PagoResuelto {
  idIntentoPago: number;
  estado: (typeof ESTADOS_PAGO_RESUELTO)[number];
  resolucion: ResolucionPago;
  motivo: string;
  fechaResolucion: Date;
  idPedido: number | null;
  idReembolso: number | null;
}

export interface ResolucionDePago extends Omit<PagoResuelto, 'idPedido' | 'idReembolso'> {
  pedido: Pedido | null;
  reembolso: { idReembolso: number; estado: EstadoReembolso } | null;
}

/** Lo que la pasarela necesita para devolver el dinero de un reembolso tomado (plan E6-H03 §3). */
export interface ReembolsoParaProcesar {
  idReembolso: number;
  origen: Reembolso['origen'];
  monto: Decimal;
  llave: string;
  /** El reclamo de esta toma: un fallo solo se registra si sigue vigente. */
  tokenReclamo: string;
  idTransaccion: string | null;
  llaveIntento: string;
}

export type ResultadoReembolso =
  { exito: true; idTransaccionReembolso: string | null } | { exito: false; error: string };

/** N-09: el pedido cancelado con su reembolso. */
export interface Cancelacion {
  pedido: Pedido;
  reembolso: { idReembolso: number; estado: EstadoReembolso };
}

/** N-10: la devolución registrada con su reembolso. */
export interface DevolucionRegistrada {
  pedido: Pedido;
  devolucion: { idDevolucion: number; montoReembolso: Decimal };
  reembolso: { idReembolso: number; estado: EstadoReembolso };
}

/** aplicado = false: el resultado no se registró (reclamo desplazado o reembolso ya resuelto). */
export interface ResultadoActualizacionReembolso {
  estado: EstadoReembolso;
  aplicado: boolean;
}
