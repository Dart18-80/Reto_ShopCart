import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const ejecutar = promisify(execFile);
const RAIZ = join(import.meta.dirname, '../../../..');
const UID_ROOT = '0';

const enContenedor = async (servicio: string, comando: string): Promise<string> =>
  (
    await ejecutar('docker', ['compose', 'exec', '-T', servicio, 'sh', '-c', comando], {
      cwd: RAIZ,
    })
  ).stdout.trim();

// El UID efectivo del proceso principal del contenedor (PID 1).
const uidPrincipal = async (servicio: string): Promise<string> =>
  enContenedor(servicio, "awk '/^Uid:/ {print $3}' /proc/1/status");

describe('contenedores sin root (verificación de entrega)', () => {
  it.each(['api-1', 'api-2', 'sqlserver', 'redis'])(
    'el proceso principal de %s no corre como root',
    async (servicio) => {
      expect(await uidPrincipal(servicio)).not.toBe(UID_ROOT);
    },
  );

  it('Redis, sin root, puede escribir su volcado en /data', async () => {
    const guardado = await enContenedor(
      'redis',
      'redis-cli --no-auth-warning -p "$REDIS_PORT" -a "$REDIS_CONTRASENA" SAVE && ls /data',
    );

    expect(guardado.split('\n')).toEqual(['OK', 'dump.rdb']);
  });
});
