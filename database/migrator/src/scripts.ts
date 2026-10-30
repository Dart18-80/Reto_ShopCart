import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorMigracion } from './errores.ts';
import { leerDependencias, ordenarProgramables } from './orden.ts';

export type TipoScript = 'V' | 'R' | 'S';

export interface Script {
  nombre: string;
  tipo: TipoScript;
  checksum: Buffer;
  lotes: string[];
  /** Solo R__: dependencias declaradas con `-- depende-de:` en la primera línea. */
  dependencias: string[];
}

interface Carpeta {
  tipo: TipoScript;
  carpeta: string;
  patron: RegExp;
}

// A-09: primero la estructura (V), luego la programabilidad que depende de ella (R) y al final los datos (S).
const CARPETAS: readonly Carpeta[] = [
  { tipo: 'V', carpeta: 'migrations', patron: /^V(\d{3})__[A-Za-z0-9_]+\.sql$/ },
  { tipo: 'R', carpeta: 'programmability', patron: /^R__(?:FU|VW|SP|TR)_[A-Za-z0-9_]+\.sql$/ },
  { tipo: 'S', carpeta: 'seeds', patron: /^S(\d{3})__[A-Za-z0-9_]+\.sql$/ },
];

const BOM = String.fromCharCode(0xfeff);

const SEPARADOR_GO = /^[ \t]*GO[ \t]*(?:--.*)?$/im;

// Se normaliza antes del hash para que un checkout con CRLF o un BOM no cuenten como "script modificado".
export function normalizar(contenido: string): string {
  const sinBom = contenido.startsWith(BOM) ? contenido.slice(1) : contenido;
  return sinBom.replace(/\r\n/g, '\n');
}

export function calcularChecksum(contenido: string): Buffer {
  return createHash('sha256').update(normalizar(contenido), 'utf8').digest();
}

export function dividirEnLotes(contenido: string): string[] {
  return normalizar(contenido)
    .split(SEPARADOR_GO)
    .map((lote) => lote.trim())
    .filter((lote) => lote.length > 0);
}

export async function leerScripts(directorio: string): Promise<Script[]> {
  const scripts: Script[] = [];
  for (const carpeta of CARPETAS) {
    const leidos = await leerCarpeta(directorio, carpeta);
    scripts.push(...(carpeta.tipo === 'R' ? ordenarProgramables(leidos) : leidos));
  }
  return scripts;
}

async function leerCarpeta(
  directorio: string,
  { tipo, carpeta, patron }: Carpeta,
): Promise<Script[]> {
  const ruta = join(directorio, carpeta);
  const archivos = (await readdir(ruta)).filter((archivo) => archivo.endsWith('.sql')).sort();

  const invalidos = archivos.filter((archivo) => !patron.test(archivo));
  if (invalidos.length > 0) {
    throw new ErrorMigracion(
      `Nombres inválidos en ${carpeta}/: ${invalidos.join(', ')}. Formato esperado: ${patron.source}`,
    );
  }
  verificarVersionesUnicas(carpeta, archivos, patron);

  return Promise.all(
    archivos.map(async (nombre) => {
      const contenido = await readFile(join(ruta, nombre), 'utf8');
      return {
        nombre,
        tipo,
        checksum: calcularChecksum(contenido),
        lotes: dividirEnLotes(contenido),
        dependencias: tipo === 'R' ? leerDependencias(normalizar(contenido)) : [],
      };
    }),
  );
}

function verificarVersionesUnicas(carpeta: string, archivos: string[], patron: RegExp): void {
  const vistos = new Map<string, string>();
  for (const archivo of archivos) {
    const version = patron.exec(archivo)?.[1];
    if (version === undefined) continue;
    const anterior = vistos.get(version);
    if (anterior !== undefined) {
      throw new ErrorMigracion(
        `Versión ${version} repetida en ${carpeta}/: ${anterior} y ${archivo}`,
      );
    }
    vistos.set(version, archivo);
  }
}
