import { Writable } from 'node:stream';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import {
  crearVersionesSesionRedis,
  VIGENCIA_VERSION_SEG,
} from '../../../src/shared/adapters/versiones-sesion-redis.js';
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

function logEnMemoria() {
  const lineas: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(fragmento.toString());
      listo();
    },
  });
  return { lineas, logger: pino({ level: 'info' }, destino) };
}

describe('VersionesSesionRedis (A-07, N-15)', () => {
  it('publica la versión vigente con un TTL de la vida del access token más el margen', async () => {
    const versiones = crearVersionesSesionRedis(redis, logger);
    const idUsuario = idUnico();

    await versiones.publicar(idUsuario, 3);

    expect(await versiones.vigente(idUsuario)).toBe(3);
    const ttl = await redis.ttl(`sesion:version:${String(idUsuario)}`);
    expect(ttl).toBeGreaterThan(VIGENCIA_VERSION_SEG - 5);
    expect(ttl).toBeLessThanOrEqual(VIGENCIA_VERSION_SEG);
  });

  it('una publicación con una versión menor no la hace retroceder', async () => {
    const versiones = crearVersionesSesionRedis(redis, logger);
    const idUsuario = idUnico();

    await versiones.publicar(idUsuario, 5);
    await versiones.publicar(idUsuario, 4);

    expect(await versiones.vigente(idUsuario)).toBe(5);
  });

  it('un usuario sin cambios recientes no tiene versión en Redis', async () => {
    expect(await crearVersionesSesionRedis(redis, logger).vigente(idUnico())).toBeNull();
  });

  it('con Redis caído deja pasar (riesgo acotado a 15 min), publicar no lanza y la falla se registra una vez', async () => {
    const caido = crearClienteRedis({ ...cargarConfiguracion(process.env).redis, puerto: 1 });
    caido.on('error', () => undefined);
    const { lineas, logger: conLog } = logEnMemoria();
    const versiones = crearVersionesSesionRedis(caido, conLog);

    await expect(versiones.vigente(idUnico())).resolves.toBeNull();
    await expect(versiones.vigente(idUnico())).resolves.toBeNull();
    await expect(versiones.publicar(idUnico(), 1)).resolves.toBeUndefined();

    expect(lineas.filter((linea) => linea.includes('Redis falla en esta operación'))).toHaveLength(
      1,
    );
    expect(lineas.filter((linea) => linea.includes('No se pudo publicar'))).toHaveLength(1);
    caido.disconnect();
  });
});
