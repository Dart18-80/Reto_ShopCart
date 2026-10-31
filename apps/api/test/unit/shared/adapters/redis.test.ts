import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearVerificadorRedis } from '../../../../src/shared/adapters/redis.js';

const ESPERA_PING_MS = 500;

afterEach(() => {
  vi.useRealTimers();
});

describe('crearVerificadorRedis (RNF-2)', () => {
  it('responde true si Redis contesta el PING', async () => {
    const verificador = crearVerificadorRedis({ ping: () => Promise.resolve('PONG' as const) });

    await expect(verificador.ping()).resolves.toBe(true);
  });

  it('responde false, sin lanzar, si el PING falla', async () => {
    const verificador = crearVerificadorRedis({
      ping: () => Promise.reject<'PONG'>(new Error('WRONGPASS invalid username-password pair')),
    });

    await expect(verificador.ping()).resolves.toBe(false);
  });

  it('responde false a los 500 ms si Redis no contesta, en lugar de colgar el health', async () => {
    vi.useFakeTimers();
    const verificador = crearVerificadorRedis({ ping: () => new Promise<'PONG'>(() => undefined) });

    const resultado = verificador.ping();
    await vi.advanceTimersByTimeAsync(ESPERA_PING_MS);

    await expect(resultado).resolves.toBe(false);
  });
});
