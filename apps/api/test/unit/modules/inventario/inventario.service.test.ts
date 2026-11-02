import { describe, expect, it, vi } from 'vitest';
import type { InventarioRepository } from '../../../../src/modules/inventario/inventario.repository.js';
import { crearInventarioService } from '../../../../src/modules/inventario/inventario.service.js';
import type { Movimiento } from '../../../../src/modules/inventario/inventario.types.js';

const MOVIMIENTO: Movimiento = {
  idMovimientoKardex: 1,
  idVariante: 3,
  tipo: 'AjusteNegativo',
  signo: -1,
  cantidad: 2,
  existenciaAnterior: 5,
  existenciaResultante: 3,
  motivo: 'Conteo',
  referencia: null,
  idPedido: null,
  idDevolucion: null,
  usuario: { idUsuario: 2, nombre: 'Operador' },
  fecha: new Date(),
};

function preparar() {
  const repositorio = {
    registrarEntrada: vi.fn(() => Promise.resolve(MOVIMIENTO)),
    registrarAjuste: vi.fn(() => Promise.resolve(MOVIMIENTO)),
    obtenerKardex: vi.fn(() => Promise.resolve({ movimientos: [MOVIMIENTO], total: 7 })),
    listarExistencias: vi.fn(() => Promise.resolve({ existencias: [], total: 0 })),
    conciliar: vi.fn(() => Promise.resolve([])),
    listarExistenciaBodega: vi.fn(() => Promise.resolve({ existencias: [], total: 0 })),
  } satisfies InventarioRepository;
  return { servicio: crearInventarioService({ repositorio }), repositorio };
}

describe('inventario.service (E3-H06, N-07)', () => {
  it('un ajuste llega al SP tal como se pidió: el saldo y lo reservado los valida el SP', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.registrarAjuste({ idVariante: 3, cantidad: -2, motivo: 'Conteo' });

    expect(repositorio.registrarAjuste).toHaveBeenCalledWith(
      { idVariante: 3, cantidad: -2, motivo: 'Conteo' },
      null,
    );
  });

  it('con Idempotency-Key, el hash distingue la operación y el contenido (E5-H03)', async () => {
    const { servicio, repositorio } = preparar();
    const llave = '7b0e8c3a-3f4d-4c1e-9a55-2d6f1b0c9e11';
    const datos = { idVariante: 3, cantidad: 2, motivo: 'Conteo' };

    await servicio.registrarAjuste(datos, llave);
    await servicio.registrarAjuste({ ...datos, cantidad: 3 }, llave);
    await servicio.registrarEntrada({ idVariante: 3, cantidad: 2, motivo: 'Conteo' }, llave);

    const [primero, otroContenido] = repositorio.registrarAjuste.mock.calls.map(
      (llamada: unknown[]) => llamada[1],
    );
    const [otraOperacion] = repositorio.registrarEntrada.mock.calls.map(
      (llamada: unknown[]) => llamada[1],
    );
    expect(primero).toMatchObject({ llave });
    expect(primero).not.toEqual(otroContenido);
    expect(primero).not.toEqual(otraOperacion);
  });

  it('el kardex responde con la paginación estándar', async () => {
    const { servicio } = preparar();

    const respuesta = await servicio.obtenerKardex(3, { pagina: 2, tamano: 5 });

    expect(respuesta.paginacion).toEqual({ pagina: 2, tamano: 5, total: 7, totalPaginas: 2 });
  });
});
