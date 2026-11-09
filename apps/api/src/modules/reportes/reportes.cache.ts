import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { AvisosDeVersion } from '../../shared/avisos/index.js';
import type { Cache } from '../../shared/cache/index.js';
import { z } from '../../shared/openapi/zod.js';
import {
  DEPENDENCIAS_REPORTES,
  DOMINIOS_REPORTES,
  REPORTES_DASHBOARD,
  type DominioReportes,
  type ReporteDashboard,
} from '@shopcart/shared';

// A-11 (decisión del PO al cierre de la Fase 1): una versión por dominio de datos. Cada escritura incrementa,
// después de su commit, la de los dominios que cambia (la lista está en 01-arquitectura.md §9). Los dominios, los
// reportes y de qué dominios depende cada uno viven en @shopcart/shared: el dashboard los usa para exportar y para
// saber qué volver a pedir con cada aviso del tiempo real.
export { DOMINIOS_REPORTES, type DominioReportes };
export const REPORTES = REPORTES_DASHBOARD;
export type NombreReporte = ReporteDashboard;

/** Un cambio en un carrito ya no invalida los reportes de ventas. */
export const DEPENDENCIAS = DEPENDENCIAS_REPORTES;

export const claveDeVersion = (dominio: DominioReportes): string => `reportes:${dominio}:version`;
// TTL corto: acota lo que duran los reportes que dependen de la hora (el rango por defecto de los últimos 30
// días y los carritos que se vuelven abandonados con el paso del tiempo) y un incremento de versión fallido.
export const SEGUNDOS_CACHE_REPORTES = 60;

/**
 * Invalida la caché de reportes (A-11) y avisa a las réplicas la versión nueva (E9-H02). Nunca lanza: si Redis no
 * responde, el TTL acota lo desactualizado y no se avisa nada.
 */
export interface InvalidadorReportes {
  invalidar(dominio: DominioReportes, ...otros: DominioReportes[]): Promise<void>;
  /** Espera la escritura y, solo si se confirmó (después de su commit), invalida sus dominios. */
  tras<T>(escritura: Promise<T>, dominio: DominioReportes, ...otros: DominioReportes[]): Promise<T>;
}

export function crearInvalidadorReportes(
  cache: Cache,
  avisos: AvisosDeVersion,
): InvalidadorReportes {
  const incrementarYAvisar = async (dominio: DominioReportes) => {
    const version = await cache.incrementar(claveDeVersion(dominio));
    if (version !== null) await avisos.publicar({ dominio, version });
  };
  const invalidar = async (dominio: DominioReportes, ...otros: DominioReportes[]) => {
    await Promise.all([dominio, ...otros].map(incrementarYAvisar));
  };
  return {
    invalidar,
    async tras(escritura, dominio, ...otros) {
      const resultado = await escritura;
      await invalidar(dominio, ...otros);
      return resultado;
    },
  };
}

/** Los filtros sin los ausentes y con las claves ordenadas: dos consultas iguales dan el mismo objeto. */
export const normalizarFiltros = (filtros: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(filtros)
      .filter(([, valor]) => valor !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** El SHA-256 (hex) de los filtros normalizados: dos consultas iguales dan la misma llave. */
export const hashDeFiltros = (filtros: object): string =>
  createHash('sha256')
    .update(JSON.stringify(normalizarFiltros(filtros)))
    .digest('hex');

/** La llave lleva la versión de cada dominio del reporte: `reportes:ventas3.carritos7:resumen:{hash}`. */
export const claveDeReporte = (
  versiones: readonly (readonly [DominioReportes, number])[],
  reporte: NombreReporte,
  filtros: object,
): string =>
  `reportes:${versiones.map(([d, v]) => `${d}${String(v)}`).join('.')}:${reporte}:${hashDeFiltros(filtros)}`;

// En la caché los montos viajan como texto (Decimal.toJSON) y las fechas en ISO: al leer se restauran.
const monto = z.string().transform((valor) => new Decimal(valor));
const rango = { desde: z.string(), hasta: z.string() };

export const resumenEnCache = z.object({
  ...rango,
  ventas: monto,
  pedidos: z.number(),
  ticketPromedio: monto,
  unidades: z.number(),
  devoluciones: monto,
  envio: monto,
  carritosAbandonados: z.number(),
  montoPotencialPerdido: monto,
});

export const ventasDelPeriodoEnCache = z.array(
  z.object({ periodo: z.string(), ventas: monto, pedidos: z.number() }),
);

export const ventasDeCategoriaEnCache = z.array(
  z.object({ idCategoria: z.number(), categoria: z.string(), unidades: z.number(), ventas: monto }),
);

export const productosVendidosEnCache = z.array(
  z.object({ idProducto: z.number(), producto: z.string(), unidades: z.number(), ventas: monto }),
);

export const carritosAbandonadosEnCache = z.object({
  filas: z.array(
    z.object({
      idCarrito: z.number(),
      cliente: z.object({ idUsuario: z.number(), nombre: z.string() }).nullable(),
      fechaUltimaActividad: z.iso.datetime().transform((valor) => new Date(valor)),
      lineas: z.number(),
      unidades: z.number(),
      montoPotencial: monto,
    }),
  ),
  total: z.number(),
});
