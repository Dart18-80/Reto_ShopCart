import { paginar, solicitudIdempotente, type RespuestaPaginada } from '../../shared/http/index.js';
import type { InventarioRepository } from './inventario.repository.js';
import type { OrdenExistencias, RegistrarAjuste, RegistrarEntrada } from './inventario.schemas.js';
import type {
  Descuadre,
  Existencia,
  ExistenciaBodega,
  Movimiento,
  Pagina,
} from './inventario.types.js';

interface Dependencias {
  repositorio: InventarioRepository;
}

// N-07: el saldo, el motivo y lo reservado los valida el SP bajo el bloqueo de la variante; toda
// existencia cambia por SP_Inventario_RegistrarMovimiento. El servicio solo orquesta.
export function crearInventarioService({ repositorio }: Dependencias) {
  return {
    // E5-H03: con Idempotency-Key, un reintento tras un error de red no registra dos veces el movimiento.
    registrarEntrada: (datos: RegistrarEntrada, llave?: string): Promise<Movimiento> =>
      repositorio.registrarEntrada(datos, solicitudIdempotente(llave, 'Inventario.Entrada', datos)),

    registrarAjuste: (datos: RegistrarAjuste, llave?: string): Promise<Movimiento> =>
      repositorio.registrarAjuste(datos, solicitudIdempotente(llave, 'Inventario.Ajuste', datos)),

    async obtenerKardex(
      idVariante: number,
      pagina: Pagina,
    ): Promise<RespuestaPaginada<Movimiento>> {
      const { movimientos, total } = await repositorio.obtenerKardex(idVariante, pagina);
      return paginar(movimientos, total, pagina);
    },

    async listarExistencias(
      idVariante: number | null,
      pagina: Pagina,
      orden: OrdenExistencias,
    ): Promise<RespuestaPaginada<Existencia>> {
      const { existencias, total } = await repositorio.listarExistencias(idVariante, pagina, orden);
      return paginar(existencias, total, pagina);
    },

    conciliar: (): Promise<Descuadre[]> => repositorio.conciliar(),

    async listarExistenciaBodega(
      idVariante: number | null,
      pagina: Pagina,
    ): Promise<RespuestaPaginada<ExistenciaBodega>> {
      const { existencias, total } = await repositorio.listarExistenciaBodega(idVariante, pagina);
      return paginar(existencias, total, pagina);
    },
  };
}

export type InventarioService = ReturnType<typeof crearInventarioService>;
