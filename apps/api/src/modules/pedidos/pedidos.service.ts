import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import type { Rol } from '../../shared/http/index.js';
import type { PedidosRepository } from './pedidos.repository.js';
import type {
  CambiarEstado,
  ListarPedidosGestion,
  ListarPedidosPropios,
} from './pedidos.schemas.js';
import { transicionPermitida } from './pedidos.transiciones.js';
import type {
  Pedido,
  PedidoGestion,
  ResumenPedido,
  ResumenPedidoGestion,
} from './pedidos.types.js';

const pedidoNoEncontrado = () => new AppError('NO_ENCONTRADO', { mensaje: 'El pedido no existe.' });

interface Dependencias {
  repositorio: Pick<
    PedidosRepository,
    'listarPropios' | 'listarGestion' | 'obtener' | 'obtenerGestion' | 'cambiarEstado'
  >;
}

export function crearPedidosService({ repositorio }: Dependencias) {
  return {
    listarPropios: ({ pagina, tamano }: ListarPedidosPropios): Promise<PaginaSP<ResumenPedido>> =>
      repositorio.listarPropios(pagina, tamano),

    async obtenerPropio(idPedido: number): Promise<Pedido> {
      const pedido = await repositorio.obtener(idPedido);
      // RF-01: un pedido ajeno responde igual que uno inexistente (el SP filtra por el cliente del token).
      if (pedido === null) throw pedidoNoEncontrado();
      return pedido;
    },

    async obtenerGestion(idPedido: number): Promise<PedidoGestion> {
      const pedido = await repositorio.obtenerGestion(idPedido);
      if (pedido === null) throw pedidoNoEncontrado();
      return pedido;
    },

    listarGestion: (filtros: ListarPedidosGestion): Promise<PaginaSP<ResumenPedidoGestion>> =>
      repositorio.listarGestion(filtros),

    async cambiarEstado(idPedido: number, cambio: CambiarEstado, rol: Rol): Promise<Pedido> {
      // N-08, primera capa: un 409 claro antes de ir a la base; el SP y el trigger lo vuelven a exigir.
      if (!transicionPermitida(cambio.estadoEsperado, cambio.estadoNuevo, rol, 'Gestion')) {
        throw new AppError('TRANSICION_INVALIDA', {
          mensaje: `El pedido no puede pasar de ${cambio.estadoEsperado} a ${cambio.estadoNuevo} desde la gestión.`,
        });
      }
      return repositorio.cambiarEstado(idPedido, cambio);
    },
  };
}

export type PedidosService = ReturnType<typeof crearPedidosService>;
