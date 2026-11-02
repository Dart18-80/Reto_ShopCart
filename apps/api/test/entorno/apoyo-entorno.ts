import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
export const RAIZ = join(import.meta.dirname, '../../../..');
const ESPERA_MAXIMA_MS = 90_000;
const INTERVALO_MS = 1_000;

/** `docker compose` en la raíz del repositorio (COMPOSE_PROJECT_NAME, si está definido, elige el proyecto). */
export const compose = (...argumentos: string[]) =>
  ejecutar('docker', ['compose', ...argumentos], { cwd: RAIZ });

export async function esperar(
  condicion: () => Promise<boolean>,
  descripcion: string,
): Promise<void> {
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  while (Date.now() < limite) {
    if (await condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS));
  }
  throw new Error(`No se cumplió a tiempo: ${descripcion}`);
}

const saludable = async (servicio: string) =>
  (await compose('ps', servicio, '--format', '{{.Health}}')).stdout.trim() === 'healthy';

export const esperarSaludable = (servicio: string) =>
  esperar(() => saludable(servicio), `${servicio} saludable`);

/** Arranca un servicio detenido y espera su healthcheck. */
export async function levantar(servicio: string): Promise<void> {
  await compose('start', servicio);
  await esperarSaludable(servicio);
}
