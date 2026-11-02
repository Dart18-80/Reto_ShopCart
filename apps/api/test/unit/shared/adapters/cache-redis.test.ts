import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearCacheRedis } from '../../../../src/shared/adapters/cache-redis.js';

const CAIDO = new Error('Connection is closed.');

function preparar() {
  const cliente = {
    get: vi.fn((_clave: string): Promise<string | null> => Promise.resolve(null)),
    set: vi.fn((..._argumentos: unknown[]) => Promise.resolve('OK' as const)),
    incr: vi.fn((_clave: string) => Promise.resolve(1)),
  };
  const lineas: { level: number; msg: string }[] = [];
  const logger = pino(
    { level: 'info' },
    {
      write: (linea: string) => {
        lineas.push(JSON.parse(linea) as { level: number; msg: string });
      },
    },
  );
  return { cache: crearCacheRedis(cliente, logger), cliente, lineas };
}

describe('crearCacheRedis (A-11, RNF-2)', () => {
  it('guarda con el TTL en segundos (SET … EX) y devuelve lo que Redis responde', async () => {
    const { cache, cliente } = preparar();
    cliente.get.mockResolvedValueOnce('{"x":1}');

    await cache.guardar('reportes:v3:resumen:abc', '{"x":1}', 60);
    const leido = await cache.obtener('reportes:v3:resumen:abc');

    expect(cliente.set).toHaveBeenCalledWith('reportes:v3:resumen:abc', '{"x":1}', 'EX', 60);
    expect(leido).toBe('{"x":1}');
  });

  it('un contador que no existe vale 0', async () => {
    const { cache } = preparar();

    await expect(cache.contador('reportes:version')).resolves.toBe(0);
  });

  it('con Redis caído no lanza: obtener y contador responden null y guardar e incrementar no hacen nada', async () => {
    const { cache, cliente } = preparar();
    cliente.get.mockRejectedValue(CAIDO);
    cliente.set.mockRejectedValue(CAIDO);
    cliente.incr.mockRejectedValue(CAIDO);

    await expect(cache.obtener('k')).resolves.toBeNull();
    await expect(cache.contador('reportes:version')).resolves.toBeNull();
    await expect(cache.guardar('k', 'v', 60)).resolves.toBeUndefined();
    await expect(cache.incrementar('reportes:version')).resolves.toBeUndefined();
  });

  it('registra solo los cambios de estado: una advertencia al caer y un aviso al volver', async () => {
    const { cache, cliente, lineas } = preparar();
    cliente.get.mockRejectedValueOnce(CAIDO).mockRejectedValueOnce(CAIDO);

    await cache.obtener('k');
    await cache.obtener('k');
    await cache.obtener('k');

    expect(lineas.map((l) => l.msg)).toEqual([
      'Redis falla en esta operación: sigue en modo degradado',
      'Redis vuelve a responder en esta operación',
    ]);
  });
});
