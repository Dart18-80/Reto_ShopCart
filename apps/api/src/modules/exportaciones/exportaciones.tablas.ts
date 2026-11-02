import { Decimal } from 'decimal.js';
import { TAMANO_MAXIMO_PAGINA } from '../../shared/http/index.js';
import type { z } from '../../shared/openapi/zod.js';
import {
  consultaRangoSchema,
  consultaVentasSchema,
  type ReportesService,
} from '../reportes/index.js';
import { ExportacionImposible } from './exportaciones.errors.js';
import type { ReporteExportable, TablaReporte } from './exportaciones.types.js';

const CERO = new Decimal(0);
const sumar = (montos: Decimal[]): Decimal =>
  montos.reduce((total, monto) => total.plus(monto), CERO);
const contar = (cantidades: number[]): number => cantidades.reduce((total, n) => total + n, 0);

type Rango = z.infer<typeof consultaRangoSchema>;

const NOMBRE_AGRUPACION = { dia: 'día', semana: 'semana', mes: 'mes' } as const;

const describirRango = ({ desde, hasta }: Rango): string =>
  desde === undefined && hasta === undefined
    ? 'Últimos 30 días'
    : `Del ${desde ?? 'inicio'} al ${hasta ?? 'hoy'}`;

interface DefinicionTabla<E extends z.ZodType<object>> {
  /** El mismo esquema de filtros que el reporte del dashboard (sin la paginación: se exporta todo). */
  filtros: E;
  /** Lee el reporte y arma la tabla; con `limiteFilas` deja de leer apenas lo pasa. */
  construir: (
    reportes: ReportesService,
    filtros: z.output<E>,
    limiteFilas: number,
  ) => Promise<TablaReporte>;
}

/** Un reporte exportable: valida sus filtros (guardados como JSON) con su propio esquema antes de leerlo. */
export interface Tabla {
  filtros: z.ZodType<object>;
  construir(
    reportes: ReportesService,
    filtros: unknown,
    limiteFilas: number,
  ): Promise<TablaReporte>;
}

const definir = <E extends z.ZodType<object>>({
  filtros,
  construir,
}: DefinicionTabla<E>): Tabla => ({
  filtros,
  construir: (reportes, crudos, limiteFilas) =>
    construir(reportes, filtrosValidos(filtros, crudos), limiteFilas),
});

/** Los filtros guardados que ya no cumplen el esquema del reporte (por ejemplo, tras cambiarlo) no se reintentan. */
function filtrosValidos<E extends z.ZodType<object>>(esquema: E, crudos: unknown): z.output<E> {
  const leidos = esquema.safeParse(crudos);
  if (!leidos.success) {
    throw new ExportacionImposible('Los filtros guardados ya no son válidos para este reporte.', {
      cause: leidos.error,
    });
  }
  return leidos.data;
}

/**
 * E7-H05: cada reporte exportable como tabla neutra, con sus totales sumados con Decimal (coinciden al centavo
 * con el reporte JSON). Un reporte nuevo es una entrada más en este mapa (abierto/cerrado).
 */
export const TABLAS = {
  resumen: definir({
    filtros: consultaRangoSchema,
    async construir(reportes, filtros) {
      const r = await reportes.resumen(filtros);
      return {
        titulo: 'Resumen de ventas',
        descripcion: `Del ${r.desde} al ${r.hasta}`,
        columnas: ['Indicador', 'Valor'],
        filas: [
          ['Ventas netas', r.ventas],
          ['Pedidos', r.pedidos],
          ['Ticket promedio', r.ticketPromedio],
          ['Unidades', r.unidades],
          ['Devoluciones', r.devoluciones],
          ['Envío', r.envio],
          ['Carritos abandonados', r.carritosAbandonados],
          ['Monto potencial perdido', r.montoPotencialPerdido],
        ],
        totales: null,
      };
    },
  }),

  ventas: definir({
    filtros: consultaVentasSchema,
    async construir(reportes, filtros) {
      const periodos = await reportes.ventasPorPeriodo(filtros);
      return {
        titulo: `Ventas por ${NOMBRE_AGRUPACION[filtros.agrupacion]}`,
        descripcion: describirRango(filtros),
        columnas: ['Periodo', 'Pedidos', 'Ventas'],
        filas: periodos.map((p) => [p.periodo, p.pedidos, p.ventas]),
        totales: [
          'Total',
          contar(periodos.map((p) => p.pedidos)),
          sumar(periodos.map((p) => p.ventas)),
        ],
      };
    },
  }),

  'ventas-por-categoria': definir({
    filtros: consultaRangoSchema,
    async construir(reportes, filtros) {
      const categorias = await reportes.ventasPorCategoria(filtros);
      return {
        titulo: 'Ventas por categoría',
        descripcion: describirRango(filtros),
        columnas: ['Categoría', 'Unidades', 'Ventas'],
        filas: categorias.map((c) => [c.categoria, c.unidades, c.ventas]),
        totales: [
          'Total',
          contar(categorias.map((c) => c.unidades)),
          sumar(categorias.map((c) => c.ventas)),
        ],
      };
    },
  }),

  'top-productos': definir({
    filtros: consultaRangoSchema,
    async construir(reportes, filtros) {
      const productos = await reportes.topProductos(filtros);
      return {
        titulo: 'Productos más vendidos',
        descripcion: describirRango(filtros),
        columnas: ['Producto', 'Unidades', 'Ventas'],
        filas: productos.map((p) => [p.producto, p.unidades, p.ventas]),
        totales: [
          'Total',
          contar(productos.map((p) => p.unidades)),
          sumar(productos.map((p) => p.ventas)),
        ],
      };
    },
  }),

  'carritos-abandonados': definir({
    filtros: consultaRangoSchema,
    async construir(reportes, filtros, limiteFilas) {
      const carritos = [];
      // El reporte se pagina en el SP: se leen páginas hasta el total o hasta pasar el límite del formato.
      for (let pagina = 1; ; pagina++) {
        const { filas, total } = await reportes.carritosAbandonados({
          ...filtros,
          pagina,
          tamano: TAMANO_MAXIMO_PAGINA,
        });
        carritos.push(...filas);
        if (filas.length === 0 || carritos.length >= total || carritos.length > limiteFilas) break;
      }
      return {
        titulo: 'Carritos abandonados',
        descripcion: describirRango(filtros),
        columnas: [
          'Carrito',
          'Cliente',
          'Última actividad',
          'Líneas',
          'Unidades',
          'Monto potencial',
        ],
        filas: carritos.map((c) => [
          c.idCarrito,
          c.cliente?.nombre ?? 'Invitado',
          c.fechaUltimaActividad,
          c.lineas,
          c.unidades,
          c.montoPotencial,
        ]),
        totales: [
          'Total',
          null,
          null,
          contar(carritos.map((c) => c.lineas)),
          contar(carritos.map((c) => c.unidades)),
          sumar(carritos.map((c) => c.montoPotencial)),
        ],
      };
    },
  }),
} satisfies Record<ReporteExportable, Tabla>;
