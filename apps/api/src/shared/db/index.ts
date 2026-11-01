import type { Logger } from 'pino';
import {
  crearEjecutorSP,
  type ConexionSP,
  type EjecutorSP,
  type NombreSP,
  type ParametrosSP,
} from './ejecutar-sp.js';

export type { ConexionSP, NombreSP, ParametroSP, ParametrosSP } from './ejecutar-sp.js';
export { bigintANumero } from './bigint.js';
export { conectarPool, conexionMssql } from './pool.js';

let ejecutor: EjecutorSP | undefined;

/** Se llama una vez al arrancar (server.ts) o en las pruebas con una conexión falsa. */
export function configurarBaseDatos(conexion: ConexionSP, logger: Logger): void {
  ejecutor = crearEjecutorSP({ conexion, logger });
}

function obtenerEjecutor(): EjecutorSP {
  if (ejecutor === undefined) {
    throw new Error(
      'La base de datos no está configurada: llama a configurarBaseDatos al arrancar.',
    );
  }
  return ejecutor;
}

// async: si la base no está configurada, el error llega por la promesa (también a un .catch()) y no
// como excepción síncrona.

/** Única forma de hablar con la base desde los repositorios (CLAUDE.md: sin SQL en el backend). */
export async function ejecutarSP<T>(nombre: NombreSP, parametros?: ParametrosSP): Promise<T[]> {
  return obtenerEjecutor().ejecutarSP<T>(nombre, parametros);
}

/**
 * Varios conjuntos de resultados con la forma que declara el repositorio, uno por elemento de la tupla
 * (igual que ejecutarSP<T> con un solo conjunto). Un conjunto que el SP no devolvió llega como undefined.
 */
export async function ejecutarSPConjuntos<T extends unknown[][]>(
  nombre: NombreSP,
  parametros?: ParametrosSP,
): Promise<Partial<T>> {
  // El SP define la forma de sus filas y el repositorio la declara en T: es el mismo cast de ejecutarSP.
  return (await obtenerEjecutor().ejecutarSPMultiple(nombre, parametros)) as Partial<T>;
}

export interface PaginaSP<T> {
  filas: T[];
  total: number;
}

/**
 * Listado paginado (sqlserver-sp §5): el SP devuelve la página y, en un segundo conjunto, el total del
 * filtro (columna Total), que es real aunque la página pedida esté vacía.
 */
export async function ejecutarSPPaginado<T>(
  nombre: NombreSP,
  parametros: ParametrosSP,
): Promise<PaginaSP<T>> {
  const [filas, totales] = await ejecutarSPConjuntos<[T[], { Total: number }[]]>(
    nombre,
    parametros,
  );
  const total = totales?.[0]?.Total;
  if (filas === undefined || total === undefined) {
    throw new Error(`${nombre} no devolvió la página y el total`);
  }
  return { filas, total };
}
