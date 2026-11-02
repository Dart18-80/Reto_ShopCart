import type { PaginaSP } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import type { PedidosRepository } from './pedidos.repository.js';
import type { ListarPedidosGestion, ListarPedidosPropios } from './pedidos.schemas.js';
import type { Pedido, ResumenPedido, ResumenPedidoGestion } from './pedidos.types.js';

interface Dependencias {
  repositorio: Pick<PedidosRepository, 'listarPropios' | 'listarGestion' | 'obtener'>;
}

export function crearPedidosService({ repositorio }: Dependencias) {
  return {
    listarPropios: ({ pagina, tamano }: ListarPedidosPropios): Promise<PaginaSP<ResumenPedido>> =>
      repositorio.listarPropios(pagina, tamano),

    async obtenerPropio(idPedido: number): Promise<Pedido> {
      const pedido = await repositorio.obtener(idPedido);
      // RF-01: un pedido ajeno responde igual que uno inexistente (el SP filtra por el cliente del token).
      if (pedido === null) throw new AppError('NO_ENCONTRADO', { mensaje: 'El pedido no existe.' });
      return pedido;
    },

    listarGestion: (filtros: ListarPedidosGestion): Promise<PaginaSP<ResumenPedidoGestion>> =>
      repositorio.listarGestion(filtros),
  };
}

export type PedidosService = ReturnType<typeof crearPedidosService>;
