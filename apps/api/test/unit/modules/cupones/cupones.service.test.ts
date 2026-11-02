import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import type { CuponesRepository } from '../../../../src/modules/cupones/cupones.repository.js';
import type {
  ActualizarCupon,
  ListarCupones,
} from '../../../../src/modules/cupones/cupones.schemas.js';
import { crearCuponesService } from '../../../../src/modules/cupones/cupones.service.js';
import type { Cupon, DatosCupon } from '../../../../src/modules/cupones/cupones.types.js';
import { AppError } from '../../../../src/shared/errors/index.js';

const CUPON: Cupon = {
  idCupon: 4,
  codigo: 'VERANO',
  descripcion: 'Verano',
  tipo: 'MontoFijo',
  valor: new Decimal(10),
  montoMaximoDescuento: null,
  montoMinimoCompra: new Decimal(0),
  categoria: null,
  fechaInicio: new Date('2026-01-01T00:00:00Z'),
  fechaFin: new Date('2026-12-31T00:00:00Z'),
  limiteUsosTotal: 10,
  limiteUsosPorCliente: 1,
  usosComprometidos: 0,
  usado: false,
  activo: true,
};

function preparar(existente: Cupon | null = CUPON) {
  const repositorio = {
    listar: vi.fn((_filtros: ListarCupones) => Promise.resolve({ filas: [CUPON], total: 1 })),
    obtener: vi.fn((_id: number) => Promise.resolve(existente)),
    crear: vi.fn((_datos: DatosCupon) => Promise.resolve(CUPON)),
    actualizar: vi.fn((_id: number, _cambios: ActualizarCupon) => Promise.resolve(CUPON)),
    cambiarEstado: vi.fn((_id: number, _activo: boolean) => Promise.resolve(CUPON)),
  } satisfies CuponesRepository;
  return { servicio: crearCuponesService({ repositorio }), repositorio };
}

describe('cupones.service (E4-H04)', () => {
  it('un cupón inexistente responde NO_ENCONTRADO', async () => {
    const { servicio } = preparar(null);

    const error = await servicio.obtener(99).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'NO_ENCONTRADO', status: 404 });
  });

  it('al crear, el tope y la categoría ausentes viajan como null', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.crear({
      codigo: 'verano',
      descripcion: 'Verano',
      tipo: 'MontoFijo',
      valor: new Decimal(10),
      montoMinimoCompra: new Decimal(0),
      fechaInicio: CUPON.fechaInicio,
      fechaFin: CUPON.fechaFin,
      limiteUsosTotal: 10,
      limiteUsosPorCliente: 1,
      activo: true,
    });

    expect(repositorio.crear).toHaveBeenCalledWith(
      expect.objectContaining({ montoMaximoDescuento: null, idCategoria: null }),
    );
  });

  it('activar y desactivar cambian el estado en el sentido pedido', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.activar(4);
    await servicio.desactivar(4);

    expect(repositorio.cambiarEstado.mock.calls).toEqual([
      [4, true],
      [4, false],
    ]);
  });
});
