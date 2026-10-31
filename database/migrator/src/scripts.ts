import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { BASE_PRUEBAS } from './conexion.ts';
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

export interface Carpeta {
  tipo: TipoScript;
  carpeta: string;
  patron: RegExp;
  /** Sin ella, DB_SCRIPTS_DIR apunta a otro lado: se falla en lugar de reportar "nada que aplicar". */
  obligatoria: boolean;
}

// A-09: primero la estructura (V), luego la programabilidad que depende de ella (R) y al final los datos (S).
const CARPETAS: readonly Carpeta[] = [
  { tipo: 'V', carpeta: 'migrations', patron: /^V(\d{3})__[A-Za-z0-9_]+\.sql$/, obligatoria: true },
  {
    tipo: 'R',
    carpeta: 'programmability',
    patron: /^R__(?:FU|VW|SP|TR)_[A-Za-z0-9_]+\.sql$/,
    obligatoria: false,
  },
  { tipo: 'S', carpeta: 'seeds', patron: /^S(\d{3})__[A-Za-z0-9_]+\.sql$/, obligatoria: false },
];

// Solo en shopcart_test y al final: SPs que preparan datos de prueba, para que las pruebas no escriban SQL.
const CARPETA_PRUEBAS: Carpeta = {
  tipo: 'R',
  carpeta: 'test',
  patron: /^R__SP_Pruebas_[A-Za-z0-9_]+\.sql$/,
  obligatoria: false,
};

export function carpetasPara(baseDatos: string): readonly Carpeta[] {
  return baseDatos === BASE_PRUEBAS ? [...CARPETAS, CARPETA_PRUEBAS] : CARPETAS;
}

const BOM = String.fromCharCode(0xfeff);

const SEPARADOR_GO = /^[ \t]*GO[ \t]*(?:--.*)?$/i;

// Se normaliza antes del hash para que un checkout con CRLF o un BOM no cuenten como "script modificado".
export function normalizar(contenido: string): string {
  const sinBom = contenido.startsWith(BOM) ? contenido.slice(1) : contenido;
  return sinBom.replace(/\r\n/g, '\n');
}

export function calcularChecksum(contenido: string): Buffer {
  return createHash('sha256').update(normalizar(contenido), 'utf8').digest();
}

export function dividirEnLotes(contenido: string): string[] {
  const lotes: string[] = [];
  let lineasDelLote: string[] = [];
  let estado: EstadoLexico = { tipo: 'codigo' };

  for (const linea of normalizar(contenido).split('\n')) {
    // Un GO solo separa si la línea empieza fuera de comentarios de bloque, cadenas e identificadores.
    if (estado.tipo === 'codigo' && SEPARADOR_GO.test(linea)) {
      lotes.push(lineasDelLote.join('\n'));
      lineasDelLote = [];
      continue;
    }
    lineasDelLote.push(linea);
    estado = recorrerLinea(linea, estado);
  }
  lotes.push(lineasDelLote.join('\n'));

  return lotes.map((lote) => lote.trim()).filter((lote) => lote.length > 0);
}

type EstadoLexico =
  | { tipo: 'codigo' }
  | { tipo: 'comentario'; profundidad: number }
  | { tipo: 'delimitado'; cierre: "'" | '"' | ']' };

const CIERRE_DE_DELIMITADOR: Readonly<Record<string, "'" | '"' | ']'>> = {
  "'": "'",
  '"': '"',
  '[': ']',
};

/** Estado léxico al final de la línea. T-SQL anida los comentarios de bloque y escapa duplicando el cierre. */
function recorrerLinea(linea: string, inicial: EstadoLexico): EstadoLexico {
  let estado = inicial;
  for (let i = 0; i < linea.length; i++) {
    const actual = linea.charAt(i);
    const par = linea.slice(i, i + 2);

    if (estado.tipo === 'comentario') {
      if (par === '/*' || par === '*/') {
        const profundidad = estado.profundidad + (par === '/*' ? 1 : -1);
        estado = profundidad === 0 ? { tipo: 'codigo' } : { tipo: 'comentario', profundidad };
        i++;
      }
    } else if (estado.tipo === 'delimitado') {
      if (actual !== estado.cierre) continue;
      if (linea.charAt(i + 1) === estado.cierre) i++;
      else estado = { tipo: 'codigo' };
    } else if (par === '--') {
      return estado;
    } else if (par === '/*') {
      estado = { tipo: 'comentario', profundidad: 1 };
      i++;
    } else {
      const cierre = CIERRE_DE_DELIMITADOR[actual];
      if (cierre !== undefined) estado = { tipo: 'delimitado', cierre };
    }
  }
  return estado;
}

export async function leerScripts(
  directorio: string,
  carpetas: readonly Carpeta[],
): Promise<Script[]> {
  await verificarDirectorio(directorio);
  const scripts: Script[] = [];
  for (const carpeta of carpetas) {
    const leidos = await leerCarpeta(directorio, carpeta);
    scripts.push(...(carpeta.tipo === 'R' ? ordenarProgramables(leidos) : leidos));
  }
  return scripts;
}

async function leerCarpeta(
  directorio: string,
  { tipo, carpeta, patron, obligatoria }: Carpeta,
): Promise<Script[]> {
  const ruta = join(directorio, carpeta);
  const encontrados = await listarArchivos(ruta);
  if (encontrados === undefined && obligatoria) {
    throw new ErrorMigracion(`Falta la carpeta ${carpeta}/ en ${directorio} (DB_SCRIPTS_DIR).`);
  }
  const archivos = (encontrados ?? []).filter((archivo) => archivo.endsWith('.sql')).sort();

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

// Sin la raíz no hay nada que leer: seguir reportaría "la base ya estaba al día" con la ruta equivocada.
async function verificarDirectorio(directorio: string): Promise<void> {
  const info = await stat(directorio).catch((error: unknown) => {
    if (codigoDeError(error) === 'ENOENT') return undefined;
    throw error;
  });
  if (info?.isDirectory() !== true) {
    throw new ErrorMigracion(`No existe el directorio de scripts: ${directorio} (DB_SCRIPTS_DIR).`);
  }
}

// git no versiona carpetas vacías: en un clon limpio, una carpeta sin scripts simplemente no existe.
/** undefined si la carpeta no existe. */
async function listarArchivos(ruta: string): Promise<string[] | undefined> {
  try {
    return await readdir(ruta);
  } catch (error) {
    if (codigoDeError(error) === 'ENOENT') return undefined;
    throw error;
  }
}

function codigoDeError(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
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
