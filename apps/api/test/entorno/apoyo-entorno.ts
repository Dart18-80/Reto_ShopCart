import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
export const RAIZ = join(import.meta.dirname, '../../../..');
const ESPERA_MAXIMA_MS = 90_000;
const INTERVALO_MS = 1_000;
// Una consulta a Docker responde en menos de un segundo; si el daemon se cuelga, la llamada se corta aquí en lugar de
// dejar la prueba (y el proceso docker) esperando para siempre.
const PLAZO_POR_LLAMADA_MS = 30_000;

/** Ejecuta un comando y lo mata si no termina en `plazoMs` (la promesa se rechaza). */
export const ejecutarConPlazo = (comando: string, argumentos: string[], plazoMs: number) =>
  ejecutar(comando, argumentos, { cwd: RAIZ, timeout: plazoMs, killSignal: 'SIGKILL' });

/** `docker` con su plazo. */
export const docker = (...argumentos: string[]) =>
  ejecutarConPlazo('docker', argumentos, PLAZO_POR_LLAMADA_MS);

/** `docker compose` en la raíz del repositorio (COMPOSE_PROJECT_NAME, si está definido, elige el proyecto). */
export const compose = (...argumentos: string[]) => docker('compose', ...argumentos);

interface OpcionesEspera {
  intentos?: number;
  intervaloMs?: number;
}

/**
 * Repite `condicion` hasta que se cumple, con un número máximo de intentos y un plazo total: lo que pase primero.
 * Cada intento que llama a Docker tiene además su propio plazo (`docker`).
 */
export async function esperar(
  condicion: () => Promise<boolean>,
  descripcion: string,
  { intentos = ESPERA_MAXIMA_MS / INTERVALO_MS, intervaloMs = INTERVALO_MS }: OpcionesEspera = {},
): Promise<void> {
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  for (let intento = 0; intento < intentos && Date.now() < limite; intento++) {
    if (await condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, intervaloMs));
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
