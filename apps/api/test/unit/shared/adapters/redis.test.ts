import { EventEmitter } from 'node:events';
import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crearVerificadorRedis,
  registrarCambiosDeEstado,
} from '../../../../src/shared/adapters/redis.js';

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

describe('registrarCambiosDeEstado (logs de Redis)', () => {
  function preparar() {
    const cliente = new EventEmitter();
    const lineas: { level: number; msg: string }[] = [];
    const logger = pino(
      { level: 'info' },
      {
        write: (linea: string) => {
          lineas.push(JSON.parse(linea) as { level: number; msg: string });
        },
      },
    );
    registrarCambiosDeEstado(cliente, logger);
    return { cliente, lineas };
  }

  it('mientras Redis sigue caído registra una sola advertencia, no una por reintento', () => {
    const { cliente, lineas } = preparar();

    for (let intento = 0; intento < 5; intento++) cliente.emit('error', new Error('ECONNREFUSED'));

    expect(lineas.map((linea) => linea.msg)).toEqual([
      'Redis no responde: la API sigue en modo degradado',
    ]);
  });

  it('registra una vez cuando vuelve y otra vez si se cae de nuevo', () => {
    const { cliente, lineas } = preparar();

    cliente.emit('error', new Error('ECONNREFUSED'));
    cliente.emit('ready');
    cliente.emit('ready');
    cliente.emit('error', new Error('ECONNRESET'));

    expect(lineas.map((linea) => linea.msg)).toEqual([
      'Redis no responde: la API sigue en modo degradado',
      'Redis disponible',
      'Redis no responde: la API sigue en modo degradado',
    ]);
  });
});
