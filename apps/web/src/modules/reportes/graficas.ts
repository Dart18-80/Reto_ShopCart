import type { Agrupacion } from '@shopcart/shared';
import { formatearCantidad, formatearConteo } from '../../shared/formato/conteo';
import {
  formatearDiaCortoCalendario,
  formatearFechaCalendario,
  formatearMesCalendario,
} from '../../shared/formato/fecha';
import { formatearMonto } from '../../shared/formato/monto';
import type { MetricaVentas } from './consultaDashboard';
import type { ProductoVendido, VentasDeCategoria, VentasDelPeriodo } from './reportes.api';

/** 05 §11 (N-11): la etiqueta de una barra negativa; la información nunca depende solo de su tono. */
export const TEXTO_NETO_CON_DEVOLUCIONES = 'Neto con devoluciones';

/** Una barra: su geometría (`valor`) y lo que se lee de ella, ya formateado desde el texto del backend. */
export interface PuntoGrafica {
  clave: string;
  /** La marca del eje. */
  etiqueta: string;
  /** El nombre completo, en el tooltip, en la tabla y en la lista de negativos. */
  titulo: string;
  valor: number;
  detalle: string;
  negativo: boolean;
}

export type Escala = 'quetzales' | 'conteo';

// Un signo menos seguido de al menos un dígito distinto de cero: «-0.00» es cero.
const PATRON_NEGATIVO = /^-[\d.]*[1-9]/;

/** N-11: si unas ventas netas del backend son negativas, leído del texto (sin pasar por `number`). */
export const esMontoNegativo = (monto: string): boolean => PATRON_NEGATIVO.test(monto);

// FE-10: un monto pasa a número solo para dibujar la barra; todo lo que se lee sale del texto con formatearMonto.
// Un DECIMAL(15,2) del backend cabe sin error en un double.
const aNumeroDeGeometria = (monto: string): number => Number(monto);

const punto = (datos: Omit<PuntoGrafica, 'negativo'>): PuntoGrafica => ({
  ...datos,
  negativo: datos.valor < 0,
});

const ventasYPedidos = (fila: VentasDelPeriodo) =>
  `${formatearMonto(fila.ventas)} · ${formatearConteo(fila.pedidos, 'pedido', 'pedidos')}`;

const ETIQUETA_DEL_PERIODO: Record<Agrupacion, (periodo: string) => string> = {
  dia: formatearDiaCortoCalendario,
  semana: formatearDiaCortoCalendario,
  mes: formatearMesCalendario,
};

// El backend nombra cada periodo por su primer día: el día, el lunes de la semana o el primero del mes.
const TITULO_DEL_PERIODO: Record<Agrupacion, (periodo: string) => string> = {
  dia: formatearFechaCalendario,
  semana: (periodo) => `Semana del ${formatearFechaCalendario(periodo)}`,
  mes: formatearMesCalendario,
};

/** El nombre completo de un periodo: «3 nov 2026», «Semana del 2 nov 2026» o «nov 2026». */
export const tituloDelPeriodo = (periodo: string, agrupacion: Agrupacion) =>
  TITULO_DEL_PERIODO[agrupacion](periodo);

/** Las ventas por periodo, en quetzales o en pedidos (05 §11: una sola métrica, sin doble eje). */
export function puntosDeVentas(
  filas: readonly VentasDelPeriodo[],
  agrupacion: Agrupacion,
  metrica: MetricaVentas,
): PuntoGrafica[] {
  return filas.map((fila) =>
    punto({
      clave: fila.periodo,
      etiqueta: ETIQUETA_DEL_PERIODO[agrupacion](fila.periodo),
      titulo: tituloDelPeriodo(fila.periodo, agrupacion),
      valor: metrica === 'quetzales' ? aNumeroDeGeometria(fila.ventas) : fila.pedidos,
      detalle: ventasYPedidos(fila),
    }),
  );
}

/** Las categorías se comparan por sus ventas, en el orden del backend (de mayor a menor). */
export const puntosDeCategorias = (filas: readonly VentasDeCategoria[]): PuntoGrafica[] =>
  filas.map((fila) =>
    punto({
      clave: String(fila.idCategoria),
      etiqueta: fila.categoria,
      titulo: fila.categoria,
      valor: aNumeroDeGeometria(fila.ventas),
      detalle: `${formatearMonto(fila.ventas)} · ${formatearConteo(fila.unidades, 'unidad', 'unidades')}`,
    }),
  );

/** El top 10 se mide en unidades, que es como lo ordena el backend. */
export const puntosDeTop = (filas: readonly ProductoVendido[]): PuntoGrafica[] =>
  filas.map((fila) =>
    punto({
      clave: String(fila.idProducto),
      etiqueta: fila.producto,
      titulo: fila.producto,
      valor: fila.unidades,
      detalle: `${formatearConteo(fila.unidades, 'unidad', 'unidades')} · ${formatearMonto(fila.ventas)}`,
    }),
  );

const formatoQuetzalesCompacto = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  notation: 'compact',
});

/**
 * Las marcas del eje: números que Recharts calcula para la escala, no montos del backend. En quetzales se abrevian
 * («Q1.5K») sin el espacio que es-GT pone tras el símbolo, igual que formatearMonto.
 */
export function formatearEscala(valor: number, escala: Escala): string {
  if (escala === 'conteo') return formatearCantidad(valor);
  return formatoQuetzalesCompacto
    .formatToParts(valor)
    .filter((parte) => parte.type !== 'literal')
    .map((parte) => parte.value)
    .join('');
}
