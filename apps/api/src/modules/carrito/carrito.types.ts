import type { Decimal } from 'decimal.js';
import type { CodigoError } from '../../shared/errors/index.js';
import type { EstadoExistencia } from '../catalogo/index.js';

export const ESTADOS_LINEA = ['Disponible', 'CantidadExcedida', 'Agotado', 'NoDisponible'] as const;
export type EstadoLinea = (typeof ESTADOS_LINEA)[number];

export const TIPOS_AVISO = ['PrecioGarantizado', 'BajoDePrecio', 'CambioDePrecio'] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

/** N-02: "Precio garantizado hasta…", "¡Bajó de precio!" o "El precio cambió de Q… a Q…". */
export interface AvisoPrecio {
  tipo: TipoAviso;
  /** BajoDePrecio: el garantizado; CambioDePrecio: el último que vio el cliente. */
  precioAnterior: Decimal | null;
}

export interface LineaCarrito {
  idLinea: number;
  idVariante: number;
  idProducto: number;
  producto: string;
  sku: string;
  descripcionAtributos: string;
  imagen: string | null;
  cantidad: number;
  precioUnitario: Decimal;
  totalLinea: Decimal;
  /** N-02: la parte del descuento del cupón que le toca a la línea. */
  descuentoLinea: Decimal;
  estado: EstadoLinea;
  /** N-06: la acción "Ajustar a X", solo en CantidadExcedida. */
  ajustarA: number | null;
  existencia: { estado: EstadoExistencia; unidadesRestantes: number | null };
  garantiaHasta: Date;
  aviso: AvisoPrecio | null;
}

export interface ResumenCarrito {
  lineas: number;
  unidades: number;
  subtotal: Decimal;
  descuento: Decimal;
  total: Decimal;
  puedePagar: boolean;
  cupon: { codigo: string; descripcion: string } | null;
  /** N-12: el cupón dejó de ser válido y se quitó en esta consulta (solo en esa respuesta). */
  cuponRetirado: { codigo: string; motivo: CodigoError; mensaje: string } | null;
}

/** N-05: el carrito nunca expone su ID; se resuelve desde la sesión o la cookie. */
export interface Carrito {
  lineas: LineaCarrito[];
  resumen: ResumenCarrito;
}

/** Quien pide el carrito: el Cliente de la sesión o un invitado con (o sin) la cookie. */
export type Comprador =
  { tipo: 'cliente' } | { tipo: 'invitado'; token: string | undefined; ip: string | null };

export interface NuevaLinea {
  idVariante: number;
  cantidad: number;
}

/** Hashes de la cookie de invitado para el SP: el del carrito actual o el de uno nuevo. */
export interface CookieInvitado {
  hashActual: Buffer | null;
  hashNuevo: Buffer | null;
}

export interface CarritoConCookie {
  carrito: Carrito;
  /** Token del carrito de invitado recién creado: va solo en la cookie. */
  tokenNuevo: string | null;
}

export const TIPOS_AVISO_FUSION = ['CantidadAjustada', 'NoFusionada'] as const;

/** N-05: una línea del invitado que no pasó completa al carrito del cliente al iniciar sesión. */
export interface AvisoFusion {
  idVariante: number;
  producto: string;
  tipo: (typeof TIPOS_AVISO_FUSION)[number];
  cantidadSolicitada: number;
  /** 0 si la línea no pasó (el carrito llegó al máximo de líneas). */
  cantidadFinal: number;
}

export interface ConsultaCarrito {
  carrito: Carrito;
  /** La cookie de invitado ya no tiene un carrito Activo: se borra. */
  cookieObsoleta: boolean;
}
