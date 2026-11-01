import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { crearClienteRedis } from '../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../src/shared/config/index.js';

/**
 * Base lógica de Redis solo para las pruebas de integración. migrar:pruebas recrea shopcart_test y los
 * IDENTITY vuelven a empezar: sin una base propia que se vacíe al arrancar, un usuario nuevo heredaría
 * la clave revocado:<id> que dejó otra corrida (N-15), y las pruebas revocarían usuarios del entorno
 * levantado que tienen el mismo ID.
 */
export const BASE_REDIS_PRUEBAS = 1;

const ARCHIVO_ENTORNO = resolve(import.meta.dirname, '../../../../.env');

/** globalSetup de vitest: corre una vez, antes de todos los archivos de integración. */
export default async function vaciarRedisDePruebas(): Promise<void> {
  if (existsSync(ARCHIVO_ENTORNO)) process.loadEnvFile(ARCHIVO_ENTORNO);
  const config = cargarConfiguracion({
    ...process.env,
    REDIS_BASE_DATOS: String(BASE_REDIS_PRUEBAS),
  }).redis;
  const cliente = crearClienteRedis(config);
  try {
    await cliente.connect();
    await cliente.flushdb();
  } finally {
    cliente.disconnect();
  }
}
