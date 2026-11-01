import { pino } from 'pino';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearLimitadorRedis } from '../../../src/shared/adapters/limitador-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';

const config = cargarConfiguracion(process.env).redis;
const redis = crearClienteRedis(config);
const opciones = () => ({ prefijo: `prueba:${randomUUID()}`, intentos: 3, ventanaSeg: 60 });

async function consumirVeces(limitador: ReturnType<typeof crearLimitadorRedis>, veces: number) {
  const permitidos: boolean[] = [];
  for (let i = 0; i < veces; i++) permitidos.push((await limitador.consumir('clave')).permitido);
  return permitidos;
}

beforeAll(async () => {
  redis.on('error', () => undefined);
  await redis.connect();
});

afterAll(() => {
  redis.disconnect();
});

describe('LimitadorRedis (E2-H01, A-07)', () => {
  it('el contador vive en Redis: dos réplicas comparten los intentos', async () => {
    const comunes = opciones();
    const replica1 = crearLimitadorRedis(redis, pino({ level: 'silent' }), comunes);
    const replica2 = crearLimitadorRedis(redis, pino({ level: 'silent' }), comunes);

    await consumirVeces(replica1, 2);
    const permitidos = await consumirVeces(replica2, 2);

    expect(permitidos).toEqual([true, false]);
  });

  it('al agotar los intentos indica cuántos segundos esperar, dentro de la ventana', async () => {
    const limitador = crearLimitadorRedis(redis, pino({ level: 'silent' }), opciones());
    await consumirVeces(limitador, 3);

    const { permitido, segundosParaReintentar } = await limitador.consumir('clave');

    expect(permitido).toBe(false);
    expect(segundosParaReintentar).toBeGreaterThan(0);
    expect(segundosParaReintentar).toBeLessThanOrEqual(60);
  });

  it('con Redis caído cae al contador en memoria: no lanza y sigue limitando', async () => {
    const caido = crearClienteRedis({ ...config, puerto: 1 });
    caido.on('error', () => undefined);
    const limitador = crearLimitadorRedis(caido, pino({ level: 'silent' }), opciones());

    const permitidos = await consumirVeces(limitador, 4);

    expect(permitidos).toEqual([true, true, true, false]);
    caido.disconnect();
  });
});
