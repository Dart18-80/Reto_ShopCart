import { describe, expect, it } from 'vitest';
import { compose, docker, esperarSaludable, levantar } from './apoyo-entorno.js';

// Decisión del PO (E9): Docker espera 15 s antes del SIGKILL a todo servicio con apagado ordenado, más que la
// espera máxima de la API (10 s): el apagado de la API nunca compite con el SIGKILL.

const SERVICIOS_CON_APAGADO_ORDENADO = ['api-1', 'api-2', 'redis', 'sqlserver'];
const GRACIA_SEGUNDOS = '15';
// Lo que tarda la petición en llegar a la API (y quedar esperando a la base) y lo que se retiene después.
const ESPERA_LLEGADA_MS = 1_500;
const PETICION_RETENIDA_MS = 2_000;

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function inspeccionar(servicio: string, formato: string): Promise<string> {
  const { stdout: id } = await compose('ps', '-a', '-q', servicio);
  const { stdout } = await docker('inspect', '--format', formato, id.trim());
  return stdout.trim();
}

describe('apagado ordenado en Docker (decisión del PO en E9)', () => {
  it.each(SERVICIOS_CON_APAGADO_ORDENADO)(
    '%s tiene 15 s de gracia antes del SIGKILL',
    async (servicio) => {
      expect(await inspeccionar(servicio, '{{.Config.StopTimeout}}')).toBe(GRACIA_SEGUNDOS);
    },
  );

  it('docker stop durante una petición en curso: la petición termina con 200 y la réplica sale con 0', async () => {
    let estado: string | undefined;
    await compose('pause', 'sqlserver');
    try {
      // Desde la otra réplica, directo a api-1: la petición queda esperando a la base pausada.
      const peticion = compose(
        'exec',
        '-T',
        'api-2',
        'node',
        '-e',
        "fetch('http://api-1:3000/api/v1/productos').then((r) => console.log(r.status))",
      );
      await dormir(ESPERA_LLEGADA_MS);
      const parada = compose('stop', 'api-1');
      await dormir(PETICION_RETENIDA_MS);
      await compose('unpause', 'sqlserver');
      await parada;
      estado = (await peticion).stdout.trim();
    } finally {
      await compose('unpause', 'sqlserver').catch(() => undefined);
    }
    const codigo = await inspeccionar('api-1', '{{.State.ExitCode}}');
    const { stdout: logs } = await compose('logs', '--no-log-prefix', '--tail', '5', 'api-1');
    // La pausa deja a SQL Server unhealthy unos segundos, y api-1 depende de que esté sano para arrancar.
    await esperarSaludable('sqlserver');
    await levantar('api-1');

    expect(estado).toBe('200');
    expect(codigo).toBe('0');
    expect(logs).toContain('API detenida');
  }, 120_000);
});
