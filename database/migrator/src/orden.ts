import { ErrorMigracion } from './errores.ts';

export interface Programable {
  nombre: string;
  dependencias: string[];
}

// Funciones antes que vistas (que las usan), SPs después (que usan ambas) y triggers al final.
export const ORDEN_TIPOS = ['FU', 'VW', 'SP', 'TR'] as const;
export type TipoObjeto = (typeof ORDEN_TIPOS)[number];

const PREFIJO = /^R__(FU|VW|SP|TR)_/;
const ENCABEZADO_DEPENDENCIAS = /^--[ \t]*depende-de:(.*)$/i;

export function tipoDeObjeto(nombre: string): TipoObjeto | undefined {
  return PREFIJO.exec(nombre)?.[1] as TipoObjeto | undefined;
}

/** Lee `-- depende-de: R__X.sql, R__Y.sql` de la primera línea del archivo (ya normalizado). */
export function leerDependencias(contenido: string): string[] {
  const primeraLinea = contenido.split('\n', 1)[0] ?? '';
  const encabezado = ENCABEZADO_DEPENDENCIAS.exec(primeraLinea)?.[1];
  if (encabezado === undefined) return [];
  return encabezado
    .split(',')
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre.length > 0);
}

/** Dentro de cada tipo, orden alfabético que respeta las dependencias declaradas (solo del mismo tipo). */
export function ordenarProgramables<T extends Programable>(programables: T[]): T[] {
  const porNombre = new Map(programables.map((p) => [p.nombre, p]));
  validarDependencias(programables, porNombre);
  return ORDEN_TIPOS.flatMap((tipo) =>
    ordenarGrupo(programables.filter((p) => tipoDeObjeto(p.nombre) === tipo)),
  );
}

function validarDependencias<T extends Programable>(
  programables: T[],
  porNombre: Map<string, T>,
): void {
  const problemas: string[] = [];
  for (const programable of programables) {
    for (const dependencia of programable.dependencias) {
      if (!porNombre.has(dependencia)) {
        problemas.push(`${programable.nombre} depende de ${dependencia}, que no existe.`);
      } else if (tipoDeObjeto(dependencia) !== tipoDeObjeto(programable.nombre)) {
        problemas.push(
          `${programable.nombre} depende de ${dependencia}, que es de otro tipo: el orden FU → VW → SP → TR ya lo resuelve.`,
        );
      }
    }
  }
  if (problemas.length > 0) {
    throw new ErrorMigracion(
      ['Dependencias inválidas en programmability/:', ...problemas.map((p) => `  - ${p}`)].join(
        '\n',
      ),
    );
  }
}

// Orden topológico estable: en cada paso toma, en orden alfabético, el primero que ya no espera a nadie.
function ordenarGrupo<T extends Programable>(grupo: T[]): T[] {
  const pendientes = new Map(grupo.map((p) => [p.nombre, new Set(p.dependencias)]));
  const porNombre = new Map(grupo.map((p) => [p.nombre, p]));
  const ordenados: T[] = [];

  while (pendientes.size > 0) {
    const siguiente = [...pendientes]
      .filter(([, esperando]) => esperando.size === 0)
      .map(([nombre]) => nombre)
      .sort()[0];

    if (siguiente === undefined) {
      throw new ErrorMigracion(
        `Dependencia circular entre: ${[...pendientes.keys()].sort().join(', ')}.`,
      );
    }

    pendientes.delete(siguiente);
    for (const esperando of pendientes.values()) esperando.delete(siguiente);
    const programable = porNombre.get(siguiente);
    if (programable !== undefined) ordenados.push(programable);
  }
  return ordenados;
}
