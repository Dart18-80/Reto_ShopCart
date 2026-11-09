import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import type { EnviosRepository } from '../../../../src/modules/envios/envios.repository.js';
import type { ActualizarMetodo } from '../../../../src/modules/envios/envios.schemas.js';
import { crearEnviosService } from '../../../../src/modules/envios/envios.service.js';
import { hashearTokenOpaco } from '../../../../src/shared/http/index.js';

const TOKEN = 'k'.repeat(43);

function preparar() {
  const repositorio = {
    listarParaCarrito: vi.fn((_hash: Buffer | null) =>
      Promise.resolve({ metodos: [], minutosReserva: 15, envioGratis: null }),
    ),
    listarMetodosAdmin: vi.fn(() => Promise.resolve([])),
    actualizarMetodo: vi.fn((_id: number, datos: ActualizarMetodo) =>
      Promise.resolve({ idMetodoEnvio: 1, codigo: 'Estandar', ...datos }),
    ),
  } satisfies EnviosRepository;
  return { servicio: crearEnviosService({ repositorio }), repositorio };
}

describe('envios.service (E4-H06, N-04)', () => {
  it('el carrito del invitado viaja como el hash de su cookie, nunca como el token', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.listarParaCarrito(TOKEN);
    await servicio.listarParaCarrito(undefined);

    expect(repositorio.listarParaCarrito.mock.calls).toEqual([[hashearTokenOpaco(TOKEN)], [null]]);
  });

  it('actualizar un método pasa los datos tal cual al repositorio', async () => {
    const { servicio, repositorio } = preparar();
    const datos = {
      nombre: 'Estándar',
      costo: new Decimal(35),
      diasMin: 3,
      diasMax: 5,
      activo: true,
    };

    await servicio.actualizarMetodo(1, datos);

    expect(repositorio.actualizarMetodo).toHaveBeenCalledWith(1, datos);
  });
});
