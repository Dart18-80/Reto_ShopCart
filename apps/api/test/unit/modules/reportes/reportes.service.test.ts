import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import {
  claveDeReporte,
  crearInvalidadorReportes,
  hashDeFiltros,
  SEGUNDOS_CACHE_REPORTES,
} from '../../../../src/modules/reportes/reportes.cache.js';
import { pino } from 'pino';
import {
  crearReportesService,
  type ReportesService,
} from '../../../../src/modules/reportes/reportes.service.js';
import type { Resumen } from '../../../../src/modules/reportes/reportes.types.js';
import type { Cache } from '../../../../src/shared/cache/index.js';

const RANGO = { desde: '2026-10-01', hasta: '2026-10-31' };
const CERO = new Decimal(0);
const resumenCon = (ventas: string): Resumen => ({
  ...RANGO,
  ventas: new Decimal(ventas),
  pedidos: 1,
  unidades: 2,
  ticketPromedio: new Decimal(ventas),
  devoluciones: CERO,
  envio: CERO,
  carritosAbandonados: 0,
  montoPotencialPerdido: CERO,
});

/** La caché de Redis en memoria: compartida entre "réplicas" si se pasa la misma. */
function cacheEnMemoria() {
  const valores = new Map<string, string>();
  const cache = {
    obtener: vi.fn((clave: string) => Promise.resolve(valores.get(clave) ?? null)),
    guardar: vi.fn((clave: string, valor: string, _segundos: number) => {
      valores.set(clave, valor);
      return Promise.resolve();
    }),
    contador: vi.fn((clave: string) => Promise.resolve(Number(valores.get(clave) ?? 0))),
    incrementar: vi.fn((clave: string) => {
      valores.set(clave, String(Number(valores.get(clave) ?? 0) + 1));
      return Promise.resolve();
    }),
  } satisfies Cache;
  return cache;
}

const REDIS_CAIDO: Cache = {
  obtener: () => Promise.resolve(null),
  guardar: () => Promise.resolve(),
  contador: () => Promise.resolve(null),
  incrementar: () => Promise.resolve(),
};

// Una fila que cumple los tres reportes de lista (ventas, por categoría y top de productos).
const FILA_CON_MONTO = {
  periodo: '2026-10-01',
  pedidos: 1,
  idCategoria: 2,
  categoria: 'Calzado',
  idProducto: 3,
  producto: 'Tenis',
  unidades: 4,
  ventas: new Decimal('12.30'),
};

function preparar(cache: Cache = cacheEnMemoria()) {
  const repositorio = {
    resumen: vi.fn(() => Promise.resolve(resumenCon('120.00'))),
    ventasPorPeriodo: vi.fn((): Promise<(typeof FILA_CON_MONTO)[]> => Promise.resolve([])),
    ventasPorCategoria: vi.fn((): Promise<(typeof FILA_CON_MONTO)[]> => Promise.resolve([])),
    topProductos: vi.fn((): Promise<(typeof FILA_CON_MONTO)[]> => Promise.resolve([])),
    carritosAbandonados: vi.fn(() =>
      Promise.resolve({
        filas: [
          {
            idCarrito: 7,
            cliente: null,
            fechaUltimaActividad: new Date('2026-10-30T12:00:00.000Z'),
            lineas: 1,
            unidades: 2,
            montoPotencial: new Decimal('80.50'),
          },
        ],
        total: 1,
      }),
    ),
  };
  return {
    servicio: crearReportesService({ repositorio, cache, logger: pino({ level: 'silent' }) }),
    repositorio,
    invalidador: crearInvalidadorReportes(cache),
  };
}

describe('caché de reportes (E7-H04, A-11)', () => {
  it('la segunda consulta con los mismos filtros sale de la caché, con montos Decimal', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.resumen(RANGO);
    const segunda = await servicio.resumen({ hasta: RANGO.hasta, desde: RANGO.desde });

    expect(repositorio.resumen).toHaveBeenCalledTimes(1);
    expect(segunda.ventas).toBeInstanceOf(Decimal);
    expect(segunda.ventas.toFixed(2)).toBe('120.00');
  });

  it('guarda con la llave versionada y el TTL corto', async () => {
    const cache = cacheEnMemoria();
    const { servicio } = preparar(cache);

    await servicio.resumen(RANGO);

    expect(cache.guardar).toHaveBeenCalledWith(
      `reportes:v0:resumen:${hashDeFiltros(RANGO)}`,
      expect.any(String),
      SEGUNDOS_CACHE_REPORTES,
    );
  });

  it('filtros distintos son llaves distintas; un filtro ausente no cambia la llave', () => {
    expect(hashDeFiltros({ desde: 'a', hasta: undefined })).toBe(hashDeFiltros({ desde: 'a' }));
    expect(claveDeReporte(1, 'ventas', { agrupacion: 'dia' })).not.toBe(
      claveDeReporte(1, 'ventas', { agrupacion: 'mes' }),
    );
  });

  it('tras invalidar, la siguiente consulta vuelve a la base y ve el dato nuevo', async () => {
    const { servicio, repositorio, invalidador } = preparar();
    await servicio.resumen(RANGO);
    repositorio.resumen.mockResolvedValueOnce(resumenCon('150.00'));

    await invalidador.invalidar();
    const despues = await servicio.resumen(RANGO);

    expect(despues.ventas.toFixed(2)).toBe('150.00');
    expect(repositorio.resumen).toHaveBeenCalledTimes(2);
  });

  it('un resultado viejo que se guarda después de la invalidación no queda visible', async () => {
    const { servicio, repositorio, invalidador } = preparar();
    // Mientras se consulta la base (datos viejos), otra petición escribe e invalida.
    repositorio.resumen.mockImplementationOnce(async () => {
      await invalidador.invalidar();
      return resumenCon('120.00');
    });
    await servicio.resumen(RANGO);
    repositorio.resumen.mockResolvedValueOnce(resumenCon('150.00'));

    const despues = await servicio.resumen(RANGO);

    expect(despues.ventas.toFixed(2)).toBe('150.00');
  });

  it('dos réplicas con la misma caché comparten la versión', async () => {
    const cache = cacheEnMemoria();
    const replica1 = preparar(cache);
    const replica2 = preparar(cache);
    await replica1.servicio.resumen(RANGO);
    await replica2.servicio.resumen(RANGO);

    await replica2.invalidador.invalidar();
    await replica1.servicio.resumen(RANGO);

    expect(replica1.repositorio.resumen).toHaveBeenCalledTimes(2);
    expect(replica2.repositorio.resumen).not.toHaveBeenCalled();
  });

  it('con Redis caído consulta la base cada vez y responde igual', async () => {
    const { servicio, repositorio } = preparar(REDIS_CAIDO);

    const primera = await servicio.resumen(RANGO);
    const segunda = await servicio.resumen(RANGO);

    expect(repositorio.resumen).toHaveBeenCalledTimes(2);
    expect(segunda).toEqual(primera);
  });

  it('un valor en la caché que no se puede leer se descarta y se consulta la base', async () => {
    const cache = cacheEnMemoria();
    const { servicio, repositorio } = preparar(cache);
    await cache.guardar(claveDeReporte(0, 'resumen', RANGO), '{"ventas": 1', 60);

    const resumen = await servicio.resumen(RANGO);

    expect(resumen.ventas.toFixed(2)).toBe('120.00');
    expect(repositorio.resumen).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'ventas',
      (s: ReportesService) => s.ventasPorPeriodo({ agrupacion: 'dia' }),
      'ventasPorPeriodo',
    ],
    ['por categoría', (s: ReportesService) => s.ventasPorCategoria({}), 'ventasPorCategoria'],
    ['top de productos', (s: ReportesService) => s.topProductos({}), 'topProductos'],
  ] as const)(
    'el reporte de %s sale de la caché la segunda vez, con montos Decimal',
    async (_caso, consultar, metodo) => {
      const { servicio, repositorio } = preparar();
      repositorio[metodo].mockResolvedValue([FILA_CON_MONTO]);

      await consultar(servicio);
      const [fila] = await consultar(servicio);

      expect(repositorio[metodo]).toHaveBeenCalledTimes(1);
      expect(fila).toMatchObject({ ventas: new Decimal('12.30') });
    },
  );

  it('los carritos abandonados restauran la fecha y el monto al salir de la caché', async () => {
    const { servicio, repositorio } = preparar();
    const consulta = { pagina: 1, tamano: 20 };
    await servicio.carritosAbandonados(consulta);

    const { filas } = await servicio.carritosAbandonados(consulta);

    expect(repositorio.carritosAbandonados).toHaveBeenCalledTimes(1);
    expect(filas[0]?.fechaUltimaActividad).toEqual(new Date('2026-10-30T12:00:00.000Z'));
    expect(filas[0]?.montoPotencial.toFixed(2)).toBe('80.50');
  });
});
