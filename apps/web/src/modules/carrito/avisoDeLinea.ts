import { formatearDiaYMes } from '../../shared/formato/fecha';
import { formatearMonto } from '../../shared/formato/monto';
import type { LineaCarrito } from './carrito.api';

export type TipoAvisoDeLinea = 'error' | 'advertencia' | 'exito' | 'info';
export type AccionDelAviso = { tipo: 'ajustar'; cantidad: number } | { tipo: 'entendido' };

export interface AvisoDeLinea {
  tipo: TipoAvisoDeLinea;
  texto: string;
  accion?: AccionDelAviso;
  /** NoDisponible: la línea solo se elimina. */
  bloqueaCantidad: boolean;
}

type EstadoLinea = LineaCarrito['estado'];
type TipoAvisoPrecio = NonNullable<LineaCarrito['aviso']>['tipo'];

const aviso = (tipo: TipoAvisoDeLinea, texto: string, accion?: AccionDelAviso): AvisoDeLinea => ({
  tipo,
  texto,
  ...(accion ? { accion } : {}),
  bloqueaCantidad: false,
});

function cantidadExcedida({ ajustarA }: LineaCarrito): AvisoDeLinea {
  const disponibles = ajustarA ?? 0;
  const cuantas =
    disponibles === 1 ? 'Solo queda 1 disponible.' : `Solo hay ${String(disponibles)} disponibles.`;
  return aviso('advertencia', `${cuantas} Ajusta la cantidad para continuar.`, {
    tipo: 'ajustar',
    cantidad: disponibles,
  });
}

// M3-H02: el estado manda sobre el aviso de precio. Los textos usan los montos y la fecha tal como llegan (FE-10).
const POR_ESTADO: Partial<Record<EstadoLinea, (linea: LineaCarrito) => AvisoDeLinea>> = {
  NoDisponible: () => ({
    ...aviso('error', 'Este producto ya no está disponible.'),
    bloqueaCantidad: true,
  }),
  Agotado: () => aviso('error', 'Se agotó. Elimínalo para continuar.'),
  CantidadExcedida: cantidadExcedida,
};

const precioAnteriorDe = (linea: LineaCarrito) =>
  formatearMonto(linea.aviso?.precioAnterior ?? '0');

const POR_AVISO: Record<TipoAvisoPrecio, (linea: LineaCarrito) => AvisoDeLinea> = {
  CambioDePrecio: (linea) =>
    aviso(
      'advertencia',
      `La garantía venció y el precio cambió de ${precioAnteriorDe(linea)} a ${formatearMonto(linea.precioUnitario)}.`,
      { tipo: 'entendido' },
    ),
  BajoDePrecio: (linea) =>
    aviso('exito', `¡Bajó de precio! Antes costaba ${precioAnteriorDe(linea)}.`),
  PrecioGarantizado: (linea) =>
    aviso('info', `Precio garantizado hasta el ${formatearDiaYMes(linea.garantiaHasta)}.`),
};

/** El único aviso de una línea del carrito, o null si no tiene ninguno. */
export function avisoDeLinea(linea: LineaCarrito): AvisoDeLinea | null {
  const porEstado = POR_ESTADO[linea.estado];
  if (porEstado) return porEstado(linea);
  return linea.aviso ? POR_AVISO[linea.aviso.tipo](linea) : null;
}
