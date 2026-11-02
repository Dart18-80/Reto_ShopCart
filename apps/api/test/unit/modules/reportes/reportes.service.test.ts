import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import { crearReportesService } from '../../../../src/modules/reportes/reportes.service.js';
import type { Resumen } from '../../../../src/modules/reportes/reportes.types.js';

const RANGO = { desde: '2026-10-01', hasta: '2026-10-31' };
const CERO = new Decimal(0);
const RESUMEN: Resumen = {
  ...RANGO,
  ventas: new Decimal('120.00'),
  pedidos: 1,
  unidades: 2,
  ticketPromedio: new Decimal('120.00'),
  devoluciones: CERO,
  envio: CERO,
  carritosAbandonados: 0,
  montoPotencialPerdido: CERO,
};

function preparar() {
  const repositorio = {
    resumen: vi.fn(() => Promise.resolve(RESUMEN)),
    ventasPorPeriodo: vi.fn(() => Promise.resolve([])),
    ventasPorCategoria: vi.fn(() => Promise.resolve([])),
    topProductos: vi.fn(() => Promise.resolve([])),
    carritosAbandonados: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
  };
  return { servicio: crearReportesService({ repositorio }), repositorio };
}

describe('reportes.service (E7-H01)', () => {
  it('el resumen sale del SP con el rango pedido, sin recalcular nada (M-07)', async () => {
    const { servicio, repositorio } = preparar();

    const resumen = await servicio.resumen(RANGO);

    expect(resumen).toBe(RESUMEN);
    expect(repositorio.resumen).toHaveBeenCalledWith(RANGO);
  });

  it('los carritos abandonados se paginan en el SP con la consulta tal cual', async () => {
    const { servicio, repositorio } = preparar();
    const consulta = { pagina: 2, tamano: 10 };

    await servicio.carritosAbandonados(consulta);

    expect(repositorio.carritosAbandonados).toHaveBeenCalledWith(consulta);
  });
});
