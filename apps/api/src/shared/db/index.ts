import type { Logger } from 'pino';
import {
  crearEjecutorSP,
  type ConexionSP,
  type EjecutorSP,
  type NombreSP,
  type ParametrosSP,
} from './ejecutar-sp.js';

export type { ConexionSP, NombreSP, ParametroSP, ParametrosSP } from './ejecutar-sp.js';
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

export async function ejecutarSPMultiple(
  nombre: NombreSP,
  parametros?: ParametrosSP,
): Promise<unknown[][]> {
  return obtenerEjecutor().ejecutarSPMultiple(nombre, parametros);
}
