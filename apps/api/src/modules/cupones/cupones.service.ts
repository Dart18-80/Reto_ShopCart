import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import type { CuponesRepository } from './cupones.repository.js';
import type { ActualizarCupon, CrearCupon, ListarCupones } from './cupones.schemas.js';
import type { Cupon } from './cupones.types.js';

interface Dependencias {
  repositorio: CuponesRepository;
}

export function crearCuponesService({ repositorio }: Dependencias) {
  return {
    listar: (filtros: ListarCupones): Promise<PaginaSP<Cupon>> => repositorio.listar(filtros),

    async obtener(idCupon: number): Promise<Cupon> {
      const cupon = await repositorio.obtener(idCupon);
      if (cupon === null) throw new AppError('NO_ENCONTRADO', { mensaje: 'El cupón no existe.' });
      return cupon;
    },

    // El código se guarda en mayúsculas y su unicidad la garantiza UQ_Cupon_Codigo (N-12): lo hace el SP.
    crear: (datos: CrearCupon): Promise<Cupon> =>
      repositorio.crear({
        ...datos,
        montoMaximoDescuento: datos.montoMaximoDescuento ?? null,
        idCategoria: datos.idCategoria ?? null,
      }),

    // N-12, A-13: el SP decide bajo el bloqueo del cupón si ya se usó y el CHECK del contador rechaza un
    // límite menor que los usos comprometidos.
    actualizar: (idCupon: number, cambios: ActualizarCupon): Promise<Cupon> =>
      repositorio.actualizar(idCupon, cambios),

    activar: (idCupon: number): Promise<Cupon> => repositorio.cambiarEstado(idCupon, true),

    desactivar: (idCupon: number): Promise<Cupon> => repositorio.cambiarEstado(idCupon, false),
  };
}

export type CuponesService = ReturnType<typeof crearCuponesService>;
