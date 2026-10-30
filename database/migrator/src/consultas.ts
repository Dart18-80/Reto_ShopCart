import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Las consultas propias del migrador viven en sql/, nunca en cadenas de TypeScript.
const DIRECTORIO_SQL = resolve(import.meta.dirname, '../sql');

export type NombreConsulta =
  | 'recrear-base'
  | 'preparar-servidor'
  | 'preparar-base'
  | 'adquirir-bloqueo'
  | 'leer-historial'
  | 'registrar-script';

const leidas = new Map<NombreConsulta, Promise<string>>();

export function leerConsulta(nombre: NombreConsulta): Promise<string> {
  let consulta = leidas.get(nombre);
  if (consulta === undefined) {
    consulta = readFile(resolve(DIRECTORIO_SQL, `${nombre}.sql`), 'utf8');
    leidas.set(nombre, consulta);
  }
  return consulta;
}
