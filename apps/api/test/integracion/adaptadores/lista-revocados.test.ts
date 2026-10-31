import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearListaRevocadosRedis } from '../../../src/shared/adapters/lista-revocados-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';

const logger = pino({ level: 'silent' });
const redis = crearClienteRedis(cargarConfiguracion(process.env).redis);
// IDs que ningún usuario real tiene, para no cruzarse con otras pruebas.
const idUnico = () => 1_000_000 + Math.floor(Math.random() * 1_000_000);

beforeAll(async () => {
  redis.on('error', () => undefined);
  await redis.connect();
});

afterAll(() => {
  redis.disconnect();
});

describe('ListaRevocadosRedis (E2-H03, N-15)', () => {
  it('un usuario revocado queda en la lista con un TTL de como máximo 15 minutos', async () => {
    const lista = crearListaRevocadosRedis(redis, logger);
    const idUsuario = idUnico();

    await lista.revocar(idUsuario);

    expect(await lista.estaRevocado(idUsuario)).toBe(true);
    const ttl = await redis.ttl(`revocado:${String(idUsuario)}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60);
  });

  it('un usuario no revocado no está en la lista', async () => {
    expect(await crearListaRevocadosRedis(redis, logger).estaRevocado(idUnico())).toBe(false);
  });

  it('con Redis caído deja pasar (riesgo acotado a 15 min) y revocar no lanza', async () => {
    const caido = crearClienteRedis({ ...cargarConfiguracion(process.env).redis, puerto: 1 });
    caido.on('error', () => undefined);
    const lista = crearListaRevocadosRedis(caido, logger);

    await expect(lista.estaRevocado(idUnico())).resolves.toBe(false);
    await expect(lista.revocar(idUnico())).resolves.toBeUndefined();
    caido.disconnect();
  });
});
