import { describe, expect, it, vi } from 'vitest';
import { crearPedidosService } from '../../../../src/modules/pedidos/pedidos.service.js';
import type { Pedido, PedidoGestion } from '../../../../src/modules/pedidos/pedidos.types.js';
import type { CambiarEstado } from '../../../../src/modules/pedidos/pedidos.schemas.js';

function preparar() {
  const repositorio = {
    listarPropios: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
    listarGestion: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
    obtener: vi.fn((): Promise<Pedido | null> => Promise.resolve(null)),
    obtenerGestion: vi.fn((): Promise<PedidoGestion | null> => Promise.resolve(null)),
    cambiarEstado: vi.fn((_id: number, _cambio: CambiarEstado) =>
      Promise.reject(new Error('no se usa')),
    ),
  };
  return { servicio: crearPedidosService({ repositorio }), repositorio };
}

describe('pedidos.service (E6-H01, E6-H02)', () => {
  it('un pedido que el SP no devuelve (ajeno o inexistente) es NO_ENCONTRADO (RF-01)', async () => {
    const { servicio } = preparar();

    await expect(servicio.obtenerPropio(5)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      status: 404,
    });
  });

  it('un pedido que no existe tampoco existe para la gestión: NO_ENCONTRADO (M8-H01)', async () => {
    const { servicio } = preparar();

    await expect(servicio.obtenerGestion(5)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      status: 404,
    });
  });

  it.each([
    ['Pagado', 'Despachado', 'Operador'],
    ['Pagado', 'Cancelado', 'Operador'],
    ['Entregado', 'DevueltoParcial', 'Administrador'],
    ['Pagado', 'EnPreparacion', 'Cliente'],
  ] as const)(
    '%s → %s como %s es TRANSICION_INVALIDA sin llegar a la base',
    async (estadoEsperado, estadoNuevo, rol) => {
      const { servicio, repositorio } = preparar();

      const error = await servicio
        .cambiarEstado(1, { estadoEsperado, estadoNuevo }, rol)
        .catch((e: unknown) => e);

      expect(error).toMatchObject({ codigo: 'TRANSICION_INVALIDA', status: 409 });
      expect(repositorio.cambiarEstado).not.toHaveBeenCalled();
    },
  );

  it('una transición de gestión válida llega al SP tal como se pidió', async () => {
    const { servicio, repositorio } = preparar();
    const cambio = {
      estadoEsperado: 'Despachado',
      estadoNuevo: 'Entregado',
      motivo: 'Firmado',
    } as const;

    await servicio.cambiarEstado(9, cambio, 'Administrador').catch(() => undefined);

    expect(repositorio.cambiarEstado).toHaveBeenCalledWith(9, cambio);
  });
});
