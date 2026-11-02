import { describe, expect, it, vi } from 'vitest';
import { crearCheckoutService } from '../../../../src/modules/checkout/checkout.service.js';
import type { SesionIniciada } from '../../../../src/modules/checkout/checkout.types.js';
import { AppError } from '../../../../src/shared/errors/index.js';

function preparar() {
  const repositorio = {
    iniciarSesion: vi.fn((): Promise<SesionIniciada> => Promise.reject(new Error('no se usa'))),
    obtenerSesion: vi.fn(() => Promise.resolve(null)),
    cancelarSesion: vi.fn(() => Promise.resolve()),
  };
  return { servicio: crearCheckoutService({ repositorio }), repositorio };
}

describe('checkout.service (E5-H01)', () => {
  it('sin sesión de pago Activa responde NO_ENCONTRADO', async () => {
    const { servicio } = preparar();

    const error = await servicio.obtenerSesion().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'NO_ENCONTRADO', status: 404 });
  });

  it('cancelar delega en el SP (que decide bajo bloqueo si hay un pago en curso)', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.cancelarSesion();

    expect(repositorio.cancelarSesion).toHaveBeenCalledTimes(1);
  });
});
