import type { Cache } from '../../shared/cache/index.js';
import type { PaginaSP } from '../../shared/db/index.js';
import type { z } from '../../shared/openapi/zod.js';
import {
  carritosAbandonadosEnCache,
  claveDeReporte,
  CLAVE_VERSION_REPORTES,
  productosVendidosEnCache,
  resumenEnCache,
  SEGUNDOS_CACHE_REPORTES,
  ventasDeCategoriaEnCache,
  ventasDelPeriodoEnCache,
} from './reportes.cache.js';
import type { ReportesRepository } from './reportes.repository.js';
import type { ConsultaCarritos, ConsultaRango, ConsultaVentas } from './reportes.schemas.js';
import type {
  CarritoAbandonado,
  ProductoVendido,
  Resumen,
  VentasDeCategoria,
  VentasDelPeriodo,
} from './reportes.types.js';

/** Un valor guardado que no es JSON o no tiene la forma esperada cuenta como ausente. */
function leerGuardado<E extends z.ZodType>(texto: string, enCache: E) {
  try {
    return enCache.safeParse(JSON.parse(texto));
  } catch {
    return null;
  }
}

interface Dependencias {
  repositorio: ReportesRepository;
  cache: Cache;
}

// Casos de uso del dashboard (E7-H01). El SP agrega sobre la definición única de venta (M-07); el servicio
// guarda cada resultado en la caché con invalidación por versión (A-11, E7-H04).
export function crearReportesService({ repositorio, cache }: Dependencias) {
  /**
   * Cache-aside con versión. La versión se lee antes de consultar la base: si una escritura la incrementa
   * mientras tanto, este resultado (quizá ya viejo) queda guardado bajo la versión anterior, que nadie vuelve
   * a leer. Sin versión (Redis no responde) se consulta la base directo.
   */
  async function conCache<E extends z.ZodType>(
    reporte: string,
    filtros: object,
    enCache: E,
    consultar: () => Promise<z.output<E>>,
  ): Promise<z.output<E>> {
    const version = await cache.contador(CLAVE_VERSION_REPORTES);
    if (version === null) return consultar();
    const clave = claveDeReporte(version, reporte, filtros);
    const guardado = await cache.obtener(clave);
    const leido = guardado === null ? null : leerGuardado(guardado, enCache);
    if (leido?.success) return leido.data;
    const resultado = await consultar();
    await cache.guardar(clave, JSON.stringify(resultado), SEGUNDOS_CACHE_REPORTES);
    return resultado;
  }

  return {
    resumen: (consulta: ConsultaRango): Promise<Resumen> =>
      conCache('resumen', consulta, resumenEnCache, () => repositorio.resumen(consulta)),

    ventasPorPeriodo: (consulta: ConsultaVentas): Promise<VentasDelPeriodo[]> =>
      conCache('ventas', consulta, ventasDelPeriodoEnCache, () =>
        repositorio.ventasPorPeriodo(consulta),
      ),

    ventasPorCategoria: (consulta: ConsultaRango): Promise<VentasDeCategoria[]> =>
      conCache('ventas-por-categoria', consulta, ventasDeCategoriaEnCache, () =>
        repositorio.ventasPorCategoria(consulta),
      ),

    topProductos: (consulta: ConsultaRango): Promise<ProductoVendido[]> =>
      conCache('top-productos', consulta, productosVendidosEnCache, () =>
        repositorio.topProductos(consulta),
      ),

    carritosAbandonados: (consulta: ConsultaCarritos): Promise<PaginaSP<CarritoAbandonado>> =>
      conCache('carritos-abandonados', consulta, carritosAbandonadosEnCache, () =>
        repositorio.carritosAbandonados(consulta),
      ),
  };
}

export type ReportesService = ReturnType<typeof crearReportesService>;
