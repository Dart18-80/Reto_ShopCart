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

/** Única forma de hablar con la base desde los repositorios (CLAUDE.md: sin SQL en el backend). */
export function ejecutarSP<T>(nombre: NombreSP, parametros?: ParametrosSP): Promise<T[]> {
  return obtenerEjecutor().ejecutarSP<T>(nombre, parametros);
}

export function ejecutarSPMultiple(
  nombre: NombreSP,
  parametros?: ParametrosSP,
): Promise<unknown[][]> {
  return obtenerEjecutor().ejecutarSPMultiple(nombre, parametros);
}
