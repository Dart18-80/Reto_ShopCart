import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESPERA_VACIADO_TELEMETRIA_MS,
  esperarComoMucho,
} from '../../../../src/shared/observability/telemetria.js';

describe('apagado de la telemetría (E9-H01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin el colector, vaciar lo pendiente no retrasa el apagado más que el límite', async () => {
    const nuncaTermina = new Promise<void>(() => undefined);
    let listo = false;

    void esperarComoMucho(nuncaTermina, ESPERA_VACIADO_TELEMETRIA_MS).then(() => {
      listo = true;
    });
    await vi.advanceTimersByTimeAsync(ESPERA_VACIADO_TELEMETRIA_MS);

    expect(listo).toBe(true);
  });

  it('si el vaciado termina antes, no espera el límite', async () => {
    let listo = false;

    void esperarComoMucho(Promise.resolve(), ESPERA_VACIADO_TELEMETRIA_MS).then(() => {
      listo = true;
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(listo).toBe(true);
  });

  it('si el vaciado falla, termina igual y no deja un rechazo sin manejar (apagaría la API con 1)', async () => {
    const sinManejar = vi.fn();
    process.on('unhandledRejection', sinManejar);
    let listo = false;

    void esperarComoMucho(
      Promise.reject(new Error('colector caído')),
      ESPERA_VACIADO_TELEMETRIA_MS,
    ).then(() => {
      listo = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.runAllTimersAsync();
    process.off('unhandledRejection', sinManejar);

    expect(listo).toBe(true);
    expect(sinManejar).not.toHaveBeenCalled();
  });

  it('el límite deja margen dentro de la espera del apagado ordenado (10 s)', () => {
    expect(ESPERA_VACIADO_TELEMETRIA_MS).toBeLessThanOrEqual(3_000);
  });
});
