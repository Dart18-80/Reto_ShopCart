import { createHash } from 'node:crypto';
import { Decimal } from 'decimal.js';
import type { Cache } from '../../shared/cache/index.js';
import { z } from '../../shared/openapi/zod.js';

// A-11: la versión global de los reportes. Cada escritura que cambia lo que leen las vistas del dashboard la
// incrementa después de su commit (la lista está en 01-arquitectura.md §9).
export const CLAVE_VERSION_REPORTES = 'reportes:version';
// TTL corto: acota lo que duran los reportes que dependen de la hora (el rango por defecto de los últimos 30
// días y los carritos que se vuelven abandonados con el paso del tiempo) y un incremento de versión fallido.
export const SEGUNDOS_CACHE_REPORTES = 60;

/** Invalida la caché de reportes (A-11). Nunca lanza: si Redis no responde, el TTL acota lo desactualizado. */
export interface InvalidadorReportes {
  invalidar(): Promise<void>;
  /** Espera la escritura y, solo si se confirmó (después de su commit), invalida. */
  tras<T>(escritura: Promise<T>): Promise<T>;
}

export function crearInvalidadorReportes(cache: Cache): InvalidadorReportes {
  const invalidar = () => cache.incrementar(CLAVE_VERSION_REPORTES);
  return {
    invalidar,
    async tras(escritura) {
      const resultado = await escritura;
      await invalidar();
      return resultado;
    },
  };
}

/** Los filtros sin los ausentes y con las claves ordenadas: dos consultas iguales dan la misma llave. */
export function hashDeFiltros(filtros: object): string {
  const normalizados = Object.fromEntries(
    Object.entries(filtros)
      .filter(([, valor]) => valor !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash('sha256').update(JSON.stringify(normalizados)).digest('hex');
}

export const claveDeReporte = (version: number, reporte: string, filtros: object): string =>
  `reportes:v${String(version)}:${reporte}:${hashDeFiltros(filtros)}`;

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
